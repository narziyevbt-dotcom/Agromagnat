import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import type { SmsConfig } from '../../../config/configuration';
import { SmsService } from './sms.service';

/**
 * Eskiz.uz provider.
 *
 * Eskiz issues a bearer token that expires; rather than refreshing on a timer we
 * cache it and re-authenticate once on the first 401, which is both simpler and
 * correct when the process has been idle for days.
 */
@Injectable()
export class EskizSmsService implements SmsService {
  private readonly logger = new Logger('EskizSms');
  private token: string | null = null;
  private login: Promise<string> | null = null;

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  private get settings(): SmsConfig {
    return this.config.getOrThrow<SmsConfig>('sms');
  }

  async send(phone: string, text: string): Promise<boolean> {
    try {
      return await this.dispatch(phone, text);
    } catch (error) {
      if (this.isUnauthorized(error)) {
        this.token = null;
        try {
          return await this.dispatch(phone, text);
        } catch (retryError) {
          this.logger.error(`Eskiz send failed after re-auth: ${this.describe(retryError)}`);
          return false;
        }
      }
      this.logger.error(`Eskiz send failed: ${this.describe(error)}`);
      return false;
    }
  }

  private async dispatch(phone: string, text: string): Promise<boolean> {
    const { eskizBaseUrl, eskizFrom } = this.settings;
    const token = await this.authenticate();

    const response = await firstValueFrom(
      this.http.post(
        `${eskizBaseUrl}/message/sms/send`,
        {
          // Eskiz expects a bare 12-digit MSISDN, not the +998 display form.
          mobile_phone: phone.replace(/\D/g, ''),
          message: text,
          from: eskizFrom,
        },
        { headers: { Authorization: `Bearer ${token}` } },
      ),
    );

    if (response.status < 200 || response.status >= 300) {
      return false;
    }

    return this.accepted(response.data);
  }

  /**
   * Eskiz answers 200 to a message it is not going to deliver.
   *
   * An unmoderated text is the common case: Eskiz only sends message bodies it
   * has approved in advance, and an unapproved one comes back with an HTTP 200
   * and a refusal in the body. Trusting the status code alone means telling a
   * farmer "code sent", logging nothing, and waiting for a support call that
   * says the SMS never arrived — which is the worst possible way to find out.
   *
   * The body's shape is not assumed. A known-good marker passes, a known-bad
   * one fails, and anything unrecognised is treated as sent *and logged in
   * full*, so a shape we have not seen shows up in the logs rather than
   * silently blocking every login.
   */
  private accepted(body: unknown): boolean {
    const status = String(
      (body as { status?: unknown } | null)?.status ?? '',
    ).toLowerCase();

    // What Eskiz says when it has taken the message.
    if (['waiting', 'accepted', 'queued', 'delivered', 'transmitted'].includes(status)) {
      return true;
    }

    if (['rejected', 'failed', 'error', 'undelivered'].includes(status)) {
      this.logger.error(`Eskiz refused the message: ${JSON.stringify(body)}`);
      return false;
    }

    this.logger.warn(`Eskiz returned an unfamiliar body: ${JSON.stringify(body)}`);
    return true;
  }

  /**
   * One login at a time.
   *
   * Without this, the first burst of sign-ups after a restart logs in once per
   * request — and a burst of sign-ups is exactly what an advertisement
   * produces. Eskiz rate-limits authentication, so the failure mode is the
   * whole launch being unable to send a single code.
   */
  private async authenticate(): Promise<string> {
    if (this.token) {
      return this.token;
    }
    if (this.login) {
      return this.login;
    }

    this.login = (async () => {
      const { eskizBaseUrl, eskizEmail, eskizPassword } = this.settings;
      try {
        const response = await firstValueFrom(
          this.http.post(`${eskizBaseUrl}/auth/login`, {
            email: eskizEmail,
            password: eskizPassword,
          }),
        );
        const token = response.data?.data?.token;
        if (!token) {
          throw new Error('Eskiz login returned no token');
        }
        this.token = token;
        return token as string;
      } finally {
        this.login = null;
      }
    })();

    return this.login;
  }

  private isUnauthorized(error: unknown): boolean {
    return (error as { response?: { status?: number } })?.response?.status === 401;
  }

  private describe(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
