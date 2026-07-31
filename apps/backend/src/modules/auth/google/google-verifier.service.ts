import { createPublicKey } from 'node:crypto';
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { GoogleConfig } from '../../../config/configuration';

/** Google publishes its signing keys here and rotates them every few days. */
const JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';

/** Both are valid `iss` values; Google uses them interchangeably. */
const ISSUERS: [string, ...string[]] = [
  'https://accounts.google.com',
  'accounts.google.com',
];

/** Keys are cached this long. Google's own Cache-Control is around 6 hours. */
const JWKS_TTL_MS = 60 * 60 * 1000;

interface Jwk {
  kid: string;
  kty: string;
  n: string;
  e: string;
  alg?: string;
}

export interface GoogleProfile {
  /** Google's stable subject id. Never the email, which people change. */
  sub: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
  picture: string | null;
}

/**
 * Verifies a Google ID token.
 *
 * Written against Google's JWKS with `node:crypto` rather than pulling in
 * `google-auth-library`, which brings the whole Google API client stack for one
 * signature check. The work here is small and entirely standard: fetch the
 * public keys, pick the one the token names, verify RS256, then check the
 * claims that actually matter.
 *
 * The claim checks are the security boundary, not the signature. A valid
 * Google signature only proves Google issued the token — it says nothing about
 * *who it was issued to*. Without the audience check, a token minted for any
 * other Google application would authenticate here, which is the classic way
 * this integration is got wrong.
 */
@Injectable()
export class GoogleVerifierService {
  private readonly logger = new Logger('GoogleAuth');
  private keys = new Map<string, string>();
  private fetchedAt = 0;
  private inFlight: Promise<void> | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
  ) {}

  private get settings(): GoogleConfig {
    return this.config.getOrThrow<GoogleConfig>('google');
  }

  get isConfigured(): boolean {
    return Boolean(this.settings.clientId);
  }

  async verify(idToken: string): Promise<GoogleProfile> {
    const { clientId } = this.settings;
    if (!clientId) {
      throw new UnauthorizedException('Google kirish sozlanmagan');
    }

    const kid = this.readKid(idToken);
    const key = await this.publicKey(kid);

    let payload: Record<string, unknown>;
    try {
      payload = await this.jwt.verifyAsync(idToken, {
        publicKey: key,
        algorithms: ['RS256'],
        // Verified here rather than by hand afterwards, so a mistake is a
        // rejected token rather than a silently skipped check.
        audience: clientId,
        issuer: ISSUERS,
      });
    } catch (error) {
      this.logger.warn(`Google token rejected: ${String(error)}`);
      throw new UnauthorizedException('Google tokeni yaroqsiz');
    }

    const sub = typeof payload.sub === 'string' ? payload.sub : null;
    if (!sub) {
      throw new UnauthorizedException('Google tokeni yaroqsiz');
    }

    // An unverified Google email is an email the person has not proved they
    // own, and treating it as identity would let somebody claim another
    // person's address. The subject is still trustworthy, so the account is
    // created — only the email is withheld.
    const emailVerified = payload.email_verified === true;

    return {
      sub,
      email: emailVerified && typeof payload.email === 'string' ? payload.email : null,
      emailVerified,
      name: typeof payload.name === 'string' ? payload.name : null,
      picture: typeof payload.picture === 'string' ? payload.picture : null,
    };
  }

  private readKid(idToken: string): string {
    const [header] = idToken.split('.');
    if (!header) {
      throw new UnauthorizedException('Google tokeni yaroqsiz');
    }
    try {
      const parsed = JSON.parse(Buffer.from(header, 'base64url').toString('utf8')) as {
        kid?: string;
        alg?: string;
      };
      if (!parsed.kid || parsed.alg !== 'RS256') {
        throw new Error('missing kid or wrong alg');
      }
      return parsed.kid;
    } catch {
      throw new UnauthorizedException('Google tokeni yaroqsiz');
    }
  }

  private async publicKey(kid: string): Promise<string> {
    const fresh = Date.now() - this.fetchedAt < JWKS_TTL_MS;
    if (fresh && this.keys.has(kid)) {
      return this.keys.get(kid)!;
    }

    // An unknown kid means Google rotated, so refetch even inside the TTL.
    await this.refreshKeys();

    const key = this.keys.get(kid);
    if (!key) {
      throw new UnauthorizedException('Google tokeni yaroqsiz');
    }
    return key;
  }

  /**
   * One fetch at a time. Without this, a burst of sign-ins after a rotation
   * would each miss the cache and hammer Google concurrently — and a rotation
   * is exactly when traffic is least forgiving.
   */
  private async refreshKeys(): Promise<void> {
    if (this.inFlight) {
      return this.inFlight;
    }

    this.inFlight = (async () => {
      try {
        const response = await fetch(JWKS_URL);
        if (!response.ok) {
          throw new Error(`JWKS ${response.status}`);
        }
        const body = (await response.json()) as { keys?: Jwk[] };

        const next = new Map<string, string>();
        for (const jwk of body.keys ?? []) {
          if (jwk.kty !== 'RSA' || !jwk.kid) continue;
          // JWK to PEM without a library: Node has understood JWK natively
          // since 16, which is what makes the extra dependency unnecessary.
          const pem = createPublicKey({ key: jwk as never, format: 'jwk' })
            .export({ type: 'spki', format: 'pem' })
            .toString();
          next.set(jwk.kid, pem);
        }

        if (!next.size) {
          throw new Error('JWKS contained no usable keys');
        }

        this.keys = next;
        this.fetchedAt = Date.now();
      } catch (error) {
        this.logger.error(`Could not refresh Google keys: ${String(error)}`);
        // The old keys stay in place. Google's rotation overlaps by days, so a
        // stale cache still verifies real tokens — far better than failing
        // every sign-in because one fetch timed out.
        throw new UnauthorizedException('Google bilan bog‘lanib bo‘lmadi');
      } finally {
        this.inFlight = null;
      }
    })();

    return this.inFlight;
  }
}
