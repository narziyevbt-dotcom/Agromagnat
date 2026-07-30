import { Global, Logger, Module, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ModuleRef } from '@nestjs/core';
import Redis from 'ioredis';
import type { RedisConfig } from '../config/configuration';
import { REDIS_CLIENT } from './redis.constants';
import { RedisService } from './redis.service';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const logger = new Logger('Redis');
        const { host, port, password, db } = config.getOrThrow<RedisConfig>('redis');
        const client = new Redis({
          host,
          port,
          password,
          db,
          lazyConnect: false,
          maxRetriesPerRequest: 3,
          retryStrategy: (attempt) => Math.min(attempt * 200, 3000),
        });
        client.on('error', (error) => logger.error(`Redis error: ${error.message}`));
        client.on('connect', () => logger.log(`Connected to ${host}:${port} (db ${db})`));
        return client;
      },
    },
    RedisService,
  ],
  exports: [REDIS_CLIENT, RedisService],
})
export class RedisModule implements OnApplicationShutdown {
  constructor(private readonly moduleRef: ModuleRef) {}

  async onApplicationShutdown(): Promise<void> {
    const client = this.moduleRef.get<Redis>(REDIS_CLIENT, { strict: false });
    await client?.quit();
  }
}
