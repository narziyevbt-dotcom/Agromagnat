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

    return response.status >= 200 && response.status < 300;
  }

  private async authenticate(): Promise<string> {
    if (this.token) {
      return this.token;
    }
    const { eskizBaseUrl, eskizEmail, eskizPassword } = this.settings;
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
    return token;
  }

  private isUnauthorized(error: unknown): boolean {
    return (error as { response?: { status?: number } })?.response?.status === 401;
  }

  private describe(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
