import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { PushConfig } from '../../config/configuration';
import { DeviceToken } from './entities/device-token.entity';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { FcmPushService } from './push/fcm-push.service';
import { MockPushService } from './push/mock-push.service';
import { PUSH_SERVICE } from './push/push.service';

@Module({
  imports: [TypeOrmModule.forFeature([DeviceToken]), HttpModule.register({ timeout: 10_000 })],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    MockPushService,
    FcmPushService,
    {
      // Chosen by env, so dev needs no Firebase project and prod never silently
      // logs notifications to a console instead of delivering them.
      provide: PUSH_SERVICE,
      inject: [ConfigService, MockPushService, FcmPushService],
      useFactory: (config: ConfigService, mock: MockPushService, fcm: FcmPushService) => {
        const { provider } = config.getOrThrow<PushConfig>('push');
        return provider === 'fcm' ? fcm : mock;
      },
    },
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
