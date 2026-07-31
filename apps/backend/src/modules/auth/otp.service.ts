import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomInt } from 'node:crypto';
import type { SmsConfig } from '../../config/configuration';
import { RedisService } from '../../redis/redis.service';
import { OtpDispatcher } from './otp-channels/otp-dispatcher.service';
import { OtpRecipient } from './otp-channels/otp-channel';

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
  /**
   * Where the code actually went. The screen says "Telegramni tekshiring" or
   * "SMS'ni tekshiring" accordingly — telling somebody to check the wrong place
   * is the fastest way to make a working code look broken.
   */
  channel: 'telegram' | 'sms' | null;
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
    private readonly dispatcher: OtpDispatcher,
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

  /**
   * Issues a code and hands it to the cheapest channel that can reach this
   * person — Telegram when we know their chat, SMS otherwise.
   *
   * The code is stored before it is sent. A delivery failure must not leave a
   * person holding a code the server has forgotten, and the reverse — stored
   * but undelivered — is recoverable by asking for another.
   */
  async request(phone: string, recipient?: OtpRecipient): Promise<OtpRequestResult> {
    await this.redis.incrWithTtl(this.rateKey(phone), OTP_RATE_WINDOW_SECONDS);

    const code = this.generateCode();
    const payload: StoredOtp = { code, attempts: 0 };
    await this.redis.set(this.codeKey(phone), payload, OTP_TTL_SECONDS);

    try {
      const channel = await this.dispatcher.deliver(recipient ?? { phone }, code);
      return { sent: true, expiresIn: OTP_TTL_SECONDS, channel };
    } catch (error) {
      this.logger.warn(`OTP delivery failed for ${phone}: ${String(error)}`);
      return { sent: false, expiresIn: OTP_TTL_SECONDS, channel: null };
    }
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
