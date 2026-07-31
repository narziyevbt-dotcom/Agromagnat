import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createSign } from 'node:crypto';
import { firstValueFrom } from 'rxjs';
import type { PushConfig } from '../../../config/configuration';
import { PushMessage, PushResult, PushService } from './push.service';

const OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const FCM_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';

/** Access tokens live an hour; refresh a minute early to avoid a race at the edge. */
const TOKEN_SKEW_SECONDS = 60;

/**
 * Firebase Cloud Messaging over the HTTP v1 API.
 *
 * The legacy server-key endpoint is gone, and v1 authenticates with a
 * short-lived OAuth token minted from a service-account JWT. That is the whole
 * reason this class signs a JWT by hand rather than pulling in firebase-admin:
 * the dependency exists to do these forty lines, and it drags the entire
 * Firebase SDK — including gRPC — into an image that only ever sends a POST.
 *
 * v1 has no multicast, so tokens are sent one request each. That is acceptable
 * here because a user has one or two devices, not thousands; the requests go out
 * concurrently and a single failure never sinks the batch.
 */
@Injectable()
export class FcmPushService implements PushService {
  private readonly logger = new Logger('FcmPush');
  private accessToken: string | null = null;
  private accessTokenExpiresAt = 0;

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  private get settings(): PushConfig {
    return this.config.getOrThrow<PushConfig>('push');
  }

  async send(tokens: string[], message: PushMessage): Promise<PushResult> {
    if (!tokens.length) {
      return { sent: 0, invalidTokens: [] };
    }

    let accessToken: string;
    try {
      accessToken = await this.authenticate();
    } catch (error) {
      // Credentials are wrong or Google is down. Neither is the caller's problem.
      this.logger.error(`FCM auth failed: ${describe(error)}`);
      return { sent: 0, invalidTokens: [] };
    }

    const outcomes = await Promise.all(
      tokens.map((token) => this.deliver(token, message, accessToken)),
    );

    return {
      sent: outcomes.filter((outcome) => outcome === 'sent').length,
      invalidTokens: tokens.filter((_, index) => outcomes[index] === 'invalid'),
    };
  }

  private async deliver(
    token: string,
    message: PushMessage,
    accessToken: string,
  ): Promise<'sent' | 'failed' | 'invalid'> {
    const { projectId } = this.settings;

    try {
      await firstValueFrom(
        this.http.post(
          `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
          {
            message: {
              token,
              notification: { title: message.title, body: message.body },
              data: message.data,
              // The audience is on Android with intermittent connectivity: a
              // chat message has to wake the device rather than wait for the
              // next maintenance window.
              android: { priority: 'HIGH', notification: { sound: 'default' } },
            },
          },
          { headers: { Authorization: `Bearer ${accessToken}` } },
        ),
      );
      return 'sent';
    } catch (error) {
      if (this.isTokenDead(error)) {
        return 'invalid';
      }
      this.logger.warn(`FCM send failed: ${describe(error)}`);
      return 'failed';
    }
  }

  /**
   * UNREGISTERED means the app was uninstalled or the token rotated;
   * INVALID_ARGUMENT on a send means the token string itself is malformed.
   * Both are permanent, so the row is deleted rather than retried forever.
   */
  private isTokenDead(error: unknown): boolean {
    const response = (error as { response?: { status?: number; data?: unknown } }).response;
    if (response?.status === 404) {
      return true;
    }
    if (response?.status !== 400) {
      return false;
    }
    const status = (response.data as { error?: { status?: string } } | undefined)?.error?.status;
    return status === 'INVALID_ARGUMENT' || status === 'UNREGISTERED';
  }

  /** Mints and caches an OAuth access token from the service-account key. */
  private async authenticate(): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    if (this.accessToken && now < this.accessTokenExpiresAt - TOKEN_SKEW_SECONDS) {
      return this.accessToken;
    }

    const { clientEmail, privateKey } = this.settings;
    const assertion = this.signAssertion(clientEmail, privateKey, now);

    const response = await firstValueFrom(
      this.http.post<{ access_token: string; expires_in: number }>(
        OAUTH_TOKEN_URL,
        new URLSearchParams({
          grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
          assertion,
        }).toString(),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
      ),
    );

    this.accessToken = response.data.access_token;
    this.accessTokenExpiresAt = now + response.data.expires_in;
    return this.accessToken;
  }

  /**
   * RS256 service-account assertion. The private key arrives from the
   * environment with escaped newlines, which OpenSSL rejects outright, so it is
   * unescaped before signing.
   */
  private signAssertion(clientEmail: string, privateKey: string, now: number): string {
    const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const claims = base64url(
      JSON.stringify({
        iss: clientEmail,
        scope: FCM_SCOPE,
        aud: OAUTH_TOKEN_URL,
        iat: now,
        exp: now + 3600,
      }),
    );

    const signature = createSign('RSA-SHA256')
      .update(`${header}.${claims}`)
      .sign(privateKey.replace(/\\n/g, '\n'))
      .toString('base64url');

    return `${header}.${claims}.${signature}`;
  }
}

const base64url = (value: string): string => Buffer.from(value).toString('base64url');

const describe = (error: unknown): string => {
  const response = (error as { response?: { status?: number; data?: unknown } }).response;
  if (response) {
    return `${response.status} ${JSON.stringify(response.data)}`;
  }
  return error instanceof Error ? error.message : String(error);
};
