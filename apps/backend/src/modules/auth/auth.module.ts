import { HttpModule } from '@nestjs/axios';
import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import type { SmsConfig } from '../../config/configuration';
import { User } from '../users/entities/user.entity';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { OtpService } from './otp.service';
import { EskizSmsService } from './sms/eskiz-sms.service';
import { MockSmsService } from './sms/mock-sms.service';
import { SMS_SERVICE } from './sms/sms.service';
import { TokenService } from './token.service';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    JwtModule.register({}),
    HttpModule.register({ timeout: 10_000 }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    OtpService,
    TokenService,
    MockSmsService,
    EskizSmsService,
    {
      // Provider is chosen by env, so dev never spends SMS credit and prod
      // never silently logs codes to a console.
      provide: SMS_SERVICE,
      inject: [ConfigService, MockSmsService, EskizSmsService],
      useFactory: (
        config: ConfigService,
        mock: MockSmsService,
        eskiz: EskizSmsService,
      ) => {
        const { provider } = config.getOrThrow<SmsConfig>('sms');
        return provider === 'eskiz' ? eskiz : mock;
      },
    },
    // Authentication is the default; @Public() is the documented exception.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [AuthService, TokenService],
})
export class AuthModule {}
