import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { RedisService } from '../../redis/redis.service';
import { UserRole } from '../users/entities/user.entity';
import { TokenService } from './token.service';

const USER = { id: 'user-1', phone: '+998901234567', role: UserRole.USER };

const JWT_CONFIG = {
  accessSecret: 'test-access',
  accessTtl: '15m',
  refreshSecret: 'test-refresh',
  refreshTtl: '30d',
};

describe('TokenService', () => {
  let service: TokenService;
  let keys: Set<string>;

  beforeEach(async () => {
    keys = new Set();

    const redis = {
      raw: {
        set: jest.fn(async (key: string) => {
          keys.add(key);
          return 'OK';
        }),
        get: jest.fn(async (key: string) => (keys.has(key) ? '1' : null)),
        exists: jest.fn(async (key: string) => (keys.has(key) ? 1 : 0)),
      },
      del: jest.fn(async (...target: string[]) => {
        target.forEach((k) => keys.delete(k));
        return target.length;
      }),
      delByPattern: jest.fn(async (pattern: string) => {
        const prefix = pattern.replace(/\*$/, '');
        let removed = 0;
        for (const key of [...keys]) {
          if (key.startsWith(prefix)) {
            keys.delete(key);
            removed += 1;
          }
        }
        return removed;
      }),
    };

    const moduleRef = await Test.createTestingModule({
      imports: [JwtModule.register({})],
      providers: [
        TokenService,
        { provide: RedisService, useValue: redis },
        { provide: ConfigService, useValue: { getOrThrow: () => JWT_CONFIG } },
      ],
    }).compile();

    service = moduleRef.get(TokenService);
  });

  const lookup = async (id: string) => (id === USER.id ? USER : null);

  it('issues a distinct access and refresh token', async () => {
    const pair = await service.issuePair(USER);

    expect(pair.accessToken).toEqual(expect.any(String));
    expect(pair.refreshToken).toEqual(expect.any(String));
    expect(pair.accessToken).not.toBe(pair.refreshToken);
  });

  it('rotates a refresh token into a new pair', async () => {
    const first = await service.issuePair(USER);
    const second = await service.rotate(first.refreshToken, lookup);

    expect(second.refreshToken).not.toBe(first.refreshToken);
  });

  it('refuses to reuse a rotated refresh token', async () => {
    const first = await service.issuePair(USER);
    await service.rotate(first.refreshToken, lookup);

    await expect(service.rotate(first.refreshToken, lookup)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('treats a replay as a compromise and kills every live session', async () => {
    const sessionA = await service.issuePair(USER);
    const sessionB = await service.issuePair(USER);
    await service.rotate(sessionA.refreshToken, lookup);

    // Replaying the consumed token must take the unrelated session down too.
    await expect(service.rotate(sessionA.refreshToken, lookup)).rejects.toThrow(
      UnauthorizedException,
    );
    await expect(service.rotate(sessionB.refreshToken, lookup)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a refresh token signed with the wrong secret', async () => {
    await expect(service.rotate('not-a-token', lookup)).rejects.toThrow(UnauthorizedException);
  });

  it('rejects rotation when the user has since been blocked', async () => {
    const pair = await service.issuePair(USER);
    await expect(service.rotate(pair.refreshToken, async () => null)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  describe('logout', () => {
    it('blacklists the access token and drops the refresh token', async () => {
      const pair = await service.issuePair(USER);

      expect(await service.isAccessBlacklisted(pair.accessToken)).toBe(false);
      await service.revoke(pair.refreshToken, pair.accessToken);

      expect(await service.isAccessBlacklisted(pair.accessToken)).toBe(true);
      await expect(service.rotate(pair.refreshToken, lookup)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('does not throw when handed a malformed refresh token', async () => {
      await expect(service.revoke('garbage')).resolves.toBeUndefined();
    });
  });
});
