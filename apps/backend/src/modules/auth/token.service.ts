import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { createHash, randomUUID } from 'node:crypto';
import type { JwtConfig } from '../../config/configuration';
import { RedisService } from '../../redis/redis.service';
import { UserRole } from '../users/entities/user.entity';

/** The fields a token is minted from, shared by issuePair and rotate. */
export interface TokenSubject {
  id: string;
  phone: string | null;
  role: UserRole;
  phoneVerifiedAt?: Date | null;
}

export interface AccessTokenPayload {
  sub: string;
  /** Null until the person verifies one — it is no longer a login credential. */
  phone: string | null;
  role: UserRole;
  /** Lets PhoneVerifiedGuard decide without a database round trip. */
  phoneVerified: boolean;
}

export interface RefreshTokenPayload {
  sub: string;
  /** Token id — the unit of rotation and revocation. */
  jti: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

/**
 * jsonwebtoken types `expiresIn` as a template literal ("15m", "30d", ...) that
 * a plain string from env cannot satisfy. The env schema already constrains the
 * shape, so this narrows without adding a runtime check.
 */
type ExpiresIn = JwtSignOptions['expiresIn'];

/**
 * Issues, rotates and revokes JWTs.
 *
 * Refresh tokens are single-use: rotating one revokes it. If a revoked token is
 * ever presented again the family is dropped entirely, which is what turns a
 * stolen refresh token into a detectable event rather than silent access.
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly redis: RedisService,
  ) {}

  private get settings(): JwtConfig {
    return this.config.getOrThrow<JwtConfig>('jwt');
  }

  async issuePair(user: TokenSubject): Promise<TokenPair> {
    const { accessSecret, accessTtl, refreshSecret, refreshTtl } = this.settings;
    const jti = randomUUID();

    const accessToken = await this.jwt.signAsync(
      {
        sub: user.id,
        phone: user.phone,
        role: user.role,
        // Carried in the token so PhoneVerifiedGuard costs nothing. The access
        // token is short-lived, so a freshly verified phone is reflected within
        // one refresh rather than requiring a query on every guarded request.
        phoneVerified: Boolean(user.phoneVerifiedAt),
      } satisfies AccessTokenPayload,
      { secret: accessSecret, expiresIn: accessTtl as ExpiresIn },
    );

    const refreshToken = await this.jwt.signAsync(
      { sub: user.id, jti } satisfies RefreshTokenPayload,
      { secret: refreshSecret, expiresIn: refreshTtl as ExpiresIn },
    );

    await this.redis.raw.set(
      this.activeKey(user.id, jti),
      '1',
      'EX',
      this.refreshTtlSeconds(),
    );

    return { accessToken, refreshToken };
  }

  /** Verifies a refresh token, revokes it, and returns a fresh pair. */
  async rotate(
    refreshToken: string,
    lookupUser: (id: string) => Promise<TokenSubject | null>,
  ): Promise<TokenPair> {
    const payload = await this.verifyRefresh(refreshToken);

    const active = await this.redis.raw.get(this.activeKey(payload.sub, payload.jti));
    if (!active) {
      // Either already rotated or explicitly revoked. Treat a replay as a
      // compromise and invalidate every outstanding session for this user.
      await this.revokeAll(payload.sub);
      throw new UnauthorizedException('Sessiya muddati tugagan, qaytadan kiring');
    }

    const user = await lookupUser(payload.sub);
    if (!user) {
      throw new UnauthorizedException('Foydalanuvchi topilmadi');
    }

    await this.redis.del(this.activeKey(payload.sub, payload.jti));
    return this.issuePair(user);
  }

  /** Logout — drops the presented refresh token and blacklists the access token. */
  async revoke(refreshToken: string, accessToken?: string): Promise<void> {
    const payload = await this.verifyRefresh(refreshToken).catch(() => null);
    if (payload) {
      await this.redis.del(this.activeKey(payload.sub, payload.jti));
    }
    if (accessToken) {
      await this.blacklistAccess(accessToken);
    }
  }

  async revokeAll(userId: string): Promise<void> {
    await this.redis.delByPattern(`auth:refresh:${userId}:*`);
  }

  /**
   * Access tokens are stateless, so logout cannot invalidate them by itself. We
   * store a hash of the token until its own expiry — bounded, and it never puts
   * a raw credential in Redis.
   */
  async blacklistAccess(accessToken: string): Promise<void> {
    const decoded = this.jwt.decode(accessToken) as { exp?: number } | null;
    const ttl = decoded?.exp ? decoded.exp - Math.floor(Date.now() / 1000) : 0;
    if (ttl > 0) {
      await this.redis.raw.set(this.blacklistKey(accessToken), '1', 'EX', ttl);
    }
  }

  async isAccessBlacklisted(accessToken: string): Promise<boolean> {
    return (await this.redis.raw.exists(this.blacklistKey(accessToken))) === 1;
  }

  private async verifyRefresh(token: string): Promise<RefreshTokenPayload> {
    try {
      return await this.jwt.verifyAsync<RefreshTokenPayload>(token, {
        secret: this.settings.refreshSecret,
      });
    } catch {
      throw new UnauthorizedException('Sessiya muddati tugagan, qaytadan kiring');
    }
  }

  private activeKey(userId: string, jti: string): string {
    return `auth:refresh:${userId}:${jti}`;
  }

  private blacklistKey(accessToken: string): string {
    return `auth:blacklist:${createHash('sha256').update(accessToken).digest('hex')}`;
  }

  /** Converts the configured refresh TTL ("30d", "12h", "900") to seconds. */
  private refreshTtlSeconds(): number {
    const raw = this.settings.refreshTtl;
    const match = /^(\d+)([smhd])?$/.exec(raw.trim());
    if (!match) {
      return 30 * 24 * 3600;
    }
    const value = parseInt(match[1], 10);
    const multiplier = { s: 1, m: 60, h: 3600, d: 86400 }[match[2] ?? 's'] ?? 1;
    return value * multiplier;
  }
}
