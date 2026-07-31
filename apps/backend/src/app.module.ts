import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AppConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { RedisModule } from './redis/redis.module';
import { AuthModule } from './modules/auth/auth.module';
import { AdminModule } from './modules/admin/admin.module';
import { AiModule } from './modules/ai/ai.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { ChatModule } from './modules/chat/chat.module';
import { ListingsModule } from './modules/listings/listings.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PricingModule } from './modules/pricing/pricing.module';
import { ReportsModule } from './modules/reports/reports.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { StatsModule } from './modules/stats/stats.module';
import { StorageModule } from './modules/storage/storage.module';

@Module({
  imports: [
    AppConfigModule,
    DatabaseModule,
    RedisModule,
    ScheduleModule.forRoot(),
    AuthModule,
    StorageModule,
    HealthModule,
    CatalogModule,
    ListingsModule,
    StatsModule,
    PricingModule,
    ReportsModule,
    NotificationsModule,
    ChatModule,
    ReviewsModule,
    AdminModule,
    AiModule,
  ],
})
export class AppModule {}
