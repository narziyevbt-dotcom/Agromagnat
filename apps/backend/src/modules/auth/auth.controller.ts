import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { User } from '../users/entities/user.entity';
import { AuthService } from './auth.service';
import { GoogleSignInDto, VerifyPhoneDto } from './dto/auth.dto';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { RequiresPhone } from './decorators/requires-phone.decorator';
import {
  AuthTokensDto,
  TelegramTicketDto,
  RefreshTokenDto,
  RequestOtpDto,
  RequestOtpResponseDto,
  UpdateProfileDto,
  VerifyOtpDto,
} from './dto/auth.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('request-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send a 6-digit code by SMS (3 per phone per 10 minutes)' })
  @ApiOkResponse({ type: RequestOtpResponseDto })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded' })
  requestOtp(@Body() dto: RequestOtpDto): Promise<RequestOtpResponseDto> {
    return this.auth.requestOtp(dto.phone);
  }

  @Public()
  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify the code; creates the account on first login' })
  @ApiOkResponse({ type: AuthTokensDto })
  @ApiUnauthorizedResponse({ description: 'Wrong or expired code' })
  verifyOtp(@Body() dto: VerifyOtpDto): Promise<AuthTokensDto> {
    return this.auth.verifyOtp(dto.phone, dto.code, dto.name);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Exchange a refresh token for a new pair (single use)' })
  @ApiOkResponse({ type: AuthTokensDto })
  refresh(@Body() dto: RefreshTokenDto): Promise<AuthTokensDto> {
    return this.auth.refresh(dto.refreshToken);
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke the refresh token and blacklist the access token' })
  async logout(@Body() dto: RefreshTokenDto, @Req() request: Request): Promise<void> {
    const accessToken = request.headers.authorization?.split(' ')[1];
    await this.auth.logout(dto.refreshToken, accessToken);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'The authenticated user' })
  @ApiOkResponse({ type: User })
  me(@CurrentUser('sub') userId: string): Promise<User> {
    return this.auth.me(userId);
  }

  @RequiresPhone()
  @Patch('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update name and default location' })
  @ApiOkResponse({ type: User })
  updateMe(
    @CurrentUser('sub') userId: string,
    @Body() dto: UpdateProfileDto,
  ): Promise<User> {
    return this.auth.updateProfile(userId, dto);
  }

  // ------------------------------------------------------------ google

  @Public()
  @Post('google')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Sign in with a Google ID token. No phone required to browse.',
  })
  @ApiOkResponse({ type: AuthTokensDto })
  google(@Body() dto: GoogleSignInDto): Promise<AuthTokensDto> {
    return this.auth.googleSignIn(dto.idToken);
  }

  // -------------------------------------------------- phone verification

  @Post('phone/request')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Send a code to attach a phone to the signed-in account',
  })
  @ApiOkResponse({ type: RequestOtpResponseDto })
  requestPhone(
    @CurrentUser('sub') userId: string,
    @Body() dto: RequestOtpDto,
  ): Promise<RequestOtpResponseDto> {
    return this.auth.requestPhoneVerification(userId, dto.phone);
  }

  @Post('phone/verify')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Confirm the code — returns a fresh token pair with the phone verified',
  })
  @ApiOkResponse({ type: AuthTokensDto })
  verifyPhone(
    @CurrentUser('sub') userId: string,
    @Body() dto: VerifyPhoneDto,
  ): Promise<AuthTokensDto> {
    return this.auth.verifyPhone(userId, dto.phone, dto.code);
  }

  // ---------------------------------------------------------- telegram

  @Public()
  @Post('telegram/start')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Begin a free Telegram sign-in; returns the deep link to open',
  })
  startTelegram(): Promise<TelegramTicketDto> {
    return this.auth.startTelegramSignIn();
  }

  /**
   * Polled by the browser while the person is in Telegram.
   *
   * `204` means "not yet" rather than an error: the ordinary case is a few
   * seconds of waiting, and a 404 for that would show up as a failure in every
   * log and monitor.
   */
  @Public()
  @Get('telegram/session/:ticket')
  @ApiOperation({ summary: 'Collect the session once the bot has the number' })
  @ApiOkResponse({ type: AuthTokensDto })
  @HttpCode(HttpStatus.OK)
  async telegramSession(
    @Param('ticket') ticket: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthTokensDto | undefined> {
    const tokens = await this.auth.collectTelegramSignIn(ticket);
    if (!tokens) {
      response.status(HttpStatus.NO_CONTENT);
      return undefined;
    }
    return tokens;
  }

  // ----------------------------------------------------------- sessions

  @Post('logout-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Sign out on every device' })
  logoutAll(@CurrentUser('sub') userId: string): Promise<void> {
    return this.auth.logoutAll(userId);
  }
}
