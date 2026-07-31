import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../users/entities/user.entity';
import { TelegramController } from './telegram.controller';
import { TelegramService } from './telegram.service';

/**
 * Its own module rather than part of NotificationsModule: the bot is a
 * transport used by both OTP delivery and, later, notification fan-out, and
 * AuthModule cannot import NotificationsModule without a cycle.
 */
@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [TelegramController],
  providers: [TelegramService],
  exports: [TelegramService],
})
export class TelegramModule {}
