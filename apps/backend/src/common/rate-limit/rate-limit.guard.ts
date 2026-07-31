import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { RedisService } from '../../redis/redis.service';
import { TooManyRequestsException } from '../exceptions/too-many-requests.exception';
import { RATE_LIMIT_KEY, RateLimitRule } from './rate-limit.decorator';

/**
 * Enforces `@RateLimit()`.
 *
 * Opt-in rather than global: a blanket cap across every route would throttle
 * browsing, and browsing is the product. Only the handlers that create
 * something carry one.
 *
 * Counted per account where there is one, and per address where there is not.
 * The account is the better key by far — an address is shared by a whole
 * village behind one mobile carrier NAT, and capping that is capping the market
 * — which is why every rate-limited route here also requires a verified phone.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly redis: RedisService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const rule = this.reflector.getAllAndOverride<RateLimitRule | undefined>(RATE_LIMIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!rule) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request & { user?: { sub?: string } }>();
    const who = request.user?.sub ?? request.ip ?? 'anonim';

    const count = await this.redis.incrWithTtl(
      `rate:${rule.bucket}:${who}`,
      rule.windowSeconds,
    );

    if (count > rule.limit) {
      // Deliberately vague about the exact budget. Telling a script precisely
      // how many it has left is telling it precisely how to stay under.
      throw new TooManyRequestsException(
        "Juda ko'p urinish. Biroz kutib, qaytadan urinib ko'ring",
      );
    }

    return true;
  }
}
