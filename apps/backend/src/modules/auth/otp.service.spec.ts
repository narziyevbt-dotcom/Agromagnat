import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { RedisService } from '../../redis/redis.service';
import {
  OTP_MAX_ATTEMPTS,
  OTP_MAX_REQUESTS,
  OTP_RATE_WINDOW_SECONDS,
  OTP_TTL_SECONDS,
  OtpService,
  OtpVerifyResult,
} from './otp.service';
import { SMS_SERVICE } from './sms/sms.service';

const PHONE = '+998901234567';

describe('OtpService', () => {
  let service: OtpService;
  let store: Map<string, unknown>;
  let redis: {
    get: jest.Mock;
    set: jest.Mock;
    del: jest.Mock;
    incrWithTtl: jest.Mock;
    raw: { get: jest.Mock; ttl: jest.Mock };
  };
  let sms: { send: jest.Mock };
  let counters: Map<string, number>;

  beforeEach(async () => {
    store = new Map();
    counters = new Map();

    redis = {
      get: jest.fn(async (key: string) => store.get(key) ?? null),
      set: jest.fn(async (key: string, value: unknown) => {
        store.set(key, value);
      }),
      del: jest.fn(async (...keys: string[]) => {
        keys.forEach((k) => store.delete(k));
        return keys.length;
      }),
      incrWithTtl: jest.fn(async (key: string) => {
        const next = (counters.get(key) ?? 0) + 1;
        counters.set(key, next);
        return next;
      }),
      raw: {
        get: jest.fn(async (key: string) => {
          const value = counters.get(key);
          return value === undefined ? null : String(value);
        }),
        ttl: jest.fn(async () => 120),
      },
    };

    sms = { send: jest.fn(async () => true) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        OtpService,
        { provide: RedisService, useValue: redis },
        { provide: SMS_SERVICE, useValue: sms },
        {
          provide: ConfigService,
          useValue: { getOrThrow: () => ({ provider: 'mock' }) },
        },
      ],
    }).compile();

    service = moduleRef.get(OtpService);
  });

  describe('request', () => {
    it('sends a code and reports the expiry the resend timer needs', async () => {
      const result = await service.request(PHONE);

      expect(result).toEqual({ sent: true, expiresIn: OTP_TTL_SECONDS });
      expect(sms.send).toHaveBeenCalledWith(PHONE, expect.stringContaining('000000'));
      expect(redis.incrWithTtl).toHaveBeenCalledWith(
        `otp:rate:${PHONE}`,
        OTP_RATE_WINDOW_SECONDS,
      );
    });

    it('reports sent=false when the provider rejects the number', async () => {
      sms.send.mockResolvedValue(false);
      await expect(service.request(PHONE)).resolves.toMatchObject({ sent: false });
    });
  });

  describe('isRateLimited', () => {
    it('allows exactly the quota, then throttles', async () => {
      for (let i = 0; i < OTP_MAX_REQUESTS; i += 1) {
        expect(await service.isRateLimited(PHONE)).toBe(false);
        await service.request(PHONE);
      }
      expect(await service.isRateLimited(PHONE)).toBe(true);
    });

    it('does not throttle a phone that has never asked', async () => {
      await expect(service.isRateLimited('+998900000000')).resolves.toBe(false);
    });
  });

  describe('verify', () => {
    it('accepts the correct code and consumes it', async () => {
      await service.request(PHONE);

      await expect(service.verify(PHONE, '000000')).resolves.toBe(OtpVerifyResult.VALID);
      // Single use — the same code must not work twice.
      await expect(service.verify(PHONE, '000000')).resolves.toBe(OtpVerifyResult.EXPIRED);
    });

    it('clears the rate counter on success so login does not leave a throttle', async () => {
      await service.request(PHONE);
      await service.verify(PHONE, '000000');

      expect(redis.del).toHaveBeenCalledWith(`otp:code:${PHONE}`, `otp:rate:${PHONE}`);
    });

    it('rejects a wrong code without extending the window', async () => {
      await service.request(PHONE);

      await expect(service.verify(PHONE, '111111')).resolves.toBe(OtpVerifyResult.INVALID);
      // Re-written with the remaining TTL (120), not a fresh OTP_TTL_SECONDS.
      expect(redis.set).toHaveBeenLastCalledWith(
        `otp:code:${PHONE}`,
        { code: '000000', attempts: 1 },
        120,
      );
    });

    it('burns the code after too many wrong attempts', async () => {
      await service.request(PHONE);

      for (let i = 0; i < OTP_MAX_ATTEMPTS; i += 1) {
        await expect(service.verify(PHONE, '111111')).resolves.toBe(OtpVerifyResult.INVALID);
      }

      await expect(service.verify(PHONE, '111111')).resolves.toBe(
        OtpVerifyResult.TOO_MANY_ATTEMPTS,
      );
      // Even the right code is dead now — a new one must be requested.
      await expect(service.verify(PHONE, '000000')).resolves.toBe(OtpVerifyResult.EXPIRED);
    });

    it('reports expired when no code was ever issued', async () => {
      await expect(service.verify(PHONE, '000000')).resolves.toBe(OtpVerifyResult.EXPIRED);
    });
  });
});
