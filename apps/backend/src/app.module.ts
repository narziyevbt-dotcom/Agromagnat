import { Module } from '@nestjs/common';
import { AppConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { RedisModule } from './redis/redis.module';
import { CatalogModule } from './modules/catalog/catalog.module';

@Module({
  imports: [AppConfigModule, DatabaseModule, RedisModule, HealthModule, CatalogModule],
})
export class AppModule {}
