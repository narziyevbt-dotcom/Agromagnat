import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.constants';

/**
 * Thin typed wrapper over ioredis. Feature modules depend on this rather than
 * on ioredis directly, so the cache backend stays swappable.
 */
@Injectable()
export class RedisService {
  constructor(@Inject(REDIS_CLIENT) private readonly client: Redis) {}

  get raw(): Redis {
    return this.client;
  }

  async get<T>(key: string): Promise<T | null> {
    const raw = await this.client.get(key);
    return raw === null ? null : (JSON.parse(raw) as T);
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const payload = JSON.stringify(value);
    if (ttlSeconds && ttlSeconds > 0) {
      await this.client.set(key, payload, 'EX', ttlSeconds);
    } else {
      await this.client.set(key, payload);
    }
  }

  async del(...keys: string[]): Promise<number> {
    return keys.length ? this.client.del(...keys) : 0;
  }

  /** Deletes every key matching a glob pattern without blocking Redis (SCAN-based). */
  async delByPattern(pattern: string): Promise<number> {
    let cursor = '0';
    let removed = 0;
    do {
      const [next, keys] = await this.client.scan(cursor, 'MATCH', pattern, 'COUNT', 200);
      cursor = next;
      if (keys.length) {
        removed += await this.client.del(...keys);
      }
    } while (cursor !== '0');
    return removed;
  }

  /** Increments a counter and sets its TTL on first write — the rate-limit primitive. */
  async incrWithTtl(key: string, ttlSeconds: number): Promise<number> {
    const count = await this.client.incr(key);
    if (count === 1) {
      await this.client.expire(key, ttlSeconds);
    }
    return count;
  }

  async ping(): Promise<boolean> {
    return (await this.client.ping()) === 'PONG';
  }
}
