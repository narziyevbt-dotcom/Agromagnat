import { SetMetadata } from '@nestjs/common';

export const RATE_LIMIT_KEY = 'rate_limit';

export interface RateLimitRule {
  /** How many calls are allowed inside the window. */
  limit: number;
  /** Window length in seconds. */
  windowSeconds: number;
  /**
   * Bucket name. Endpoints sharing one share a budget — "post a listing" and
   * "edit a listing" should not each get their own allowance.
   */
  bucket: string;
}

/**
 * Caps how fast one account can call a write endpoint.
 *
 * Reads are not capped: browsing is the product, and a cap there turns a slow
 * connection retrying into a locked-out farmer. Writes are what a script abuses
 * — a marketplace with an uncapped "create listing" is one loop away from a
 * catalogue nobody can search.
 */
export const RateLimit = (rule: RateLimitRule) => SetMetadata(RATE_LIMIT_KEY, rule);
