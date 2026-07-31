import { Body, Controller, Delete, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, Length } from 'class-validator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { DevicePlatform } from './entities/device-token.entity';
import { NotificationsService } from './notifications.service';

class RegisterDeviceDto {
  @IsString()
  @Length(10, 400, { message: "Qurilma tokeni noto'g'ri" })
  token: string;

  @IsOptional()
  @IsEnum(DevicePlatform)
  platform?: DevicePlatform;
}

class UnregisterDeviceDto {
  @IsString()
  @Length(10, 400)
  token: string;
}

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('me/devices')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Register this device for push (idempotent per token)' })
  register(@CurrentUser('sub') userId: string, @Body() dto: RegisterDeviceDto) {
    return this.notifications.registerDevice(
      userId,
      dto.token,
      dto.platform ?? DevicePlatform.ANDROID,
    );
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Stop pushing to this device — called on logout' })
  async unregister(@CurrentUser('sub') userId: string, @Body() dto: UnregisterDeviceDto) {
    await this.notifications.unregisterDevice(userId, dto.token);
  }
}
