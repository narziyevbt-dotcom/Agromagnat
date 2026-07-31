import { HttpModule } from '@nestjs/axios';
import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { RateLimitGuard } from '../../common/rate-limit/rate-limit.guard';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { SmsConfig } from '../../config/configuration';
import { TelegramModule } from '../notifications/telegram/telegram.module';
import { User } from '../users/entities/user.entity';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthIdentity } from './entities/auth-identity.entity';
import { GoogleVerifierService } from './google/google-verifier.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PhoneVerifiedGuard } from './guards/phone-verified.guard';
import { RolesGuard } from './guards/roles.guard';
import { OTP_CHANNELS, OtpChannel } from './otp-channels/otp-channel';
import { OtpDispatcher } from './otp-channels/otp-dispatcher.service';
import { SmsOtpChannel } from './otp-channels/sms-otp.channel';
import { TelegramGatewayOtpChannel } from './otp-channels/telegram-gateway-otp.channel';
import { TelegramOtpChannel } from './otp-channels/telegram-otp.channel';
import { OtpService } from './otp.service';
import { EskizSmsService } from './sms/eskiz-sms.service';
import { MockSmsService } from './sms/mock-sms.service';
import { NullSmsService } from './sms/null-sms.service';
import { SMS_SERVICE } from './sms/sms.service';
import { TokenService } from './token.service';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([User, AuthIdentity]),
    JwtModule.register({}),
    TelegramModule,
    HttpModule.register({ timeout: 10_000 }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    OtpService,
    TokenService,
    GoogleVerifierService,
    TelegramOtpChannel,
    SmsOtpChannel,
    OtpDispatcher,
    {
      // Order is the fallback order, and it is a cost decision: Telegram is
      // free and instant, an SMS is neither. At volume the gap between them is
      // most of the OTP bill.
      provide: OTP_CHANNELS,
      inject: [TelegramGatewayOtpChannel, TelegramOtpChannel, SmsOtpChannel],
      // Order is the cost ladder, and it is the whole point of the list.
      // Gateway reaches a brand-new visitor for a penny; the bot is free but
      // only for somebody who has already started it; SMS reaches everyone and
      // costs the most. Each falls through to the next when it cannot deliver.
      useFactory: (
        gateway: TelegramGatewayOtpChannel,
        bot: TelegramOtpChannel,
        sms: SmsOtpChannel,
      ): OtpChannel[] => [gateway, bot, sms],
    },
    TelegramGatewayOtpChannel,
    MockSmsService,
    NullSmsService,
    EskizSmsService,
    {
      // Provider is chosen by env, so dev never spends SMS credit and prod
      // never silently logs codes to a console.
      provide: SMS_SERVICE,
      inject: [ConfigService, MockSmsService, EskizSmsService, NullSmsService],
      useFactory: (
        config: ConfigService,
        mock: MockSmsService,
        eskiz: EskizSmsService,
        none: NullSmsService,
      ) => {
        const { provider } = config.getOrThrow<SmsConfig>('sms');
        if (provider === 'eskiz') return eskiz;
        // Refuses honestly rather than pretending, which is what makes it
        // safe to run in production while Telegram Gateway carries the load.
        if (provider === 'none') return none;
        return mock;
      },
    },
    // Authentication is the default; @Public() is the documented exception.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    // Runs after the other two: it reads a claim the JWT guard put on the
    // request, and a route the roles guard already rejected never reaches it.
    { provide: APP_GUARD, useClass: PhoneVerifiedGuard },
    // Last, so a request that was going to be rejected anyway does not spend
    // somebody's budget on its way to a 401.
    { provide: APP_GUARD, useClass: RateLimitGuard },
  ],
  exports: [AuthService, TokenService],
})
export class AuthModule {}
