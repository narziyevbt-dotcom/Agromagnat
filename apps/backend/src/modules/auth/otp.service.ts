import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomInt } from 'node:crypto';
import type { SmsConfig } from '../../config/configuration';
import { RedisService } from '../../redis/redis.service';
import { SMS_SERVICE, SmsService } from './sms/sms.service';

/** OTP lifetime. Long enough for a slow SMS on a weak network. */
export const OTP_TTL_SECONDS = 300;

/** Requests allowed per phone inside the rate-limit window. */
export const OTP_MAX_REQUESTS = 3;
export const OTP_RATE_WINDOW_SECONDS = 600;

/** Wrong-code attempts before the OTP is burned and must be re-requested. */
export const OTP_MAX_ATTEMPTS = 5;

export interface OtpRequestResult {
  sent: boolean;
  /** Seconds until the code expires — the mobile resend timer uses this. */
  expiresIn: number;
}

export enum OtpVerifyResult {
  VALID = 'valid',
  INVALID = 'invalid',
  EXPIRED = 'expired',
  TOO_MANY_ATTEMPTS = 'too_many_attempts',
}

interface StoredOtp {
  code: string;
  attempts: number;
}

/**
 * Issues and verifies phone one-time codes.
 *
 * State lives in Redis, not Postgres: codes are short-lived, written on every
 * login attempt, and must vanish on their own. A TTL does that for free.
 */
@Injectable()
export class OtpService {
  private readonly logger = new Logger('Otp');

  constructor(
    private readonly redis: RedisService,
    private readonly config: ConfigService,
    @Inject(SMS_SERVICE) private readonly sms: SmsService,
  ) {}

  private codeKey(phone: string): string {
    return `otp:code:${phone}`;
  }

  private rateKey(phone: string): string {
    return `otp:rate:${phone}`;
  }

  /** True when the phone has already used up its request quota. */
  async isRateLimited(phone: string): Promise<boolean> {
    const used = await this.redis.raw.get(this.rateKey(phone));
    return used !== null && parseInt(used, 10) >= OTP_MAX_REQUESTS;
  }

  async request(phone: string): Promise<OtpRequestResult> {
    await this.redis.incrWithTtl(this.rateKey(phone), OTP_RATE_WINDOW_SECONDS);

    const code = this.generateCode();
    const payload: StoredOtp = { code, attempts: 0 };
    await this.redis.set(this.codeKey(phone), payload, OTP_TTL_SECONDS);

    const sent = await this.sms.send(
      phone,
      `Agromagnat tasdiqlash kodi: ${code}. Hech kimga aytmang.`,
    );
    if (!sent) {
      this.logger.warn(`SMS provider rejected ${phone}`);
    }

    return { sent, expiresIn: OTP_TTL_SECONDS };
  }

  async verify(phone: string, code: string): Promise<OtpVerifyResult> {
    const key = this.codeKey(phone);
    const stored = await this.redis.get<StoredOtp>(key);

    if (!stored) {
      return OtpVerifyResult.EXPIRED;
    }

    if (stored.attempts >= OTP_MAX_ATTEMPTS) {
      await this.redis.del(key);
      return OtpVerifyResult.TOO_MANY_ATTEMPTS;
    }

    if (stored.code !== code) {
      // Preserve the remaining TTL — a wrong guess must not extend the window.
      const ttl = await this.redis.raw.ttl(key);
      await this.redis.set(
        key,
        { ...stored, attempts: stored.attempts + 1 },
        ttl > 0 ? ttl : OTP_TTL_SECONDS,
      );
      return OtpVerifyResult.INVALID;
    }

    // Single use: consume the code and clear the rate counter so a successful
    // login does not leave the phone throttled.
    await this.redis.del(key, this.rateKey(phone));
    return OtpVerifyResult.VALID;
  }

  /**
   * In dev the code is fixed at 000000 so the flow can be walked without an SMS;
   * in production it is drawn from a CSPRNG.
   */
  private generateCode(): string {
    const { provider } = this.config.getOrThrow<SmsConfig>('sms');
    if (provider === 'mock') {
      return '000000';
    }
    return randomInt(0, 1_000_000).toString().padStart(6, '0');
  }
}
