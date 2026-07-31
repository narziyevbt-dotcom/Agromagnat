import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsUUID, Length, Matches } from 'class-validator';

/**
 * Uzbek mobile numbers in international form: +998 followed by 9 digits.
 * Users type them with spaces and dashes, so we strip everything but digits and
 * the leading plus before validating.
 */
const UZ_PHONE = /^\+998\d{9}$/;

const normalisePhone = ({ value }: { value: unknown }): unknown => {
  if (typeof value !== 'string') {
    return value;
  }
  const digits = value.replace(/[^\d]/g, '');
  return digits.length ? `+${digits}` : value;
};

export class RequestOtpDto {
  @ApiProperty({ example: '+998901234567' })
  @Transform(normalisePhone)
  @IsString()
  @Matches(UZ_PHONE, { message: "Telefon raqami +998XXXXXXXXX ko'rinishida bo'lishi kerak" })
  phone: string;
}

export class VerifyOtpDto {
  @ApiProperty({ example: '+998901234567' })
  @Transform(normalisePhone)
  @IsString()
  @Matches(UZ_PHONE, { message: "Telefon raqami +998XXXXXXXXX ko'rinishida bo'lishi kerak" })
  phone: string;

  @ApiProperty({ example: '000000', description: '6-digit code' })
  @IsString()
  @Matches(/^\d{6}$/, { message: "Kod 6 ta raqamdan iborat bo'lishi kerak" })
  code: string;

  @ApiProperty({
    required: false,
    example: 'Anvar aka',
    description: 'Supplied on first login; ignored for an existing user',
  })
  @IsOptional()
  @IsString()
  @Length(2, 120, { message: "Ism 2 tadan 120 tagacha belgidan iborat bo'lishi kerak" })
  name?: string;
}

export class UpdateProfileDto {
  @ApiProperty({ required: false, example: 'Anvar aka' })
  @IsOptional()
  @IsString()
  @Length(2, 120, { message: "Ism 2 tadan 120 tagacha belgidan iborat bo'lishi kerak" })
  name?: string;

  @ApiProperty({ required: false, format: 'uuid' })
  @IsOptional()
  @IsUUID('4', { message: "Viloyat noto'g'ri" })
  regionId?: string;

  @ApiProperty({ required: false, format: 'uuid' })
  @IsOptional()
  @IsUUID('4', { message: "Tuman noto'g'ri" })
  districtId?: string;
}

export class RefreshTokenDto {
  @ApiProperty()
  @IsString()
  refreshToken: string;
}

export class RequestOtpResponseDto {
  @ApiProperty()
  sent: boolean;

  @ApiProperty({ description: 'Seconds until the code expires' })
  expiresIn: number;
}

export class AuthTokensDto {
  @ApiProperty()
  accessToken: string;

  @ApiProperty()
  refreshToken: string;

  @ApiProperty({ description: 'True when this login created the account' })
  isNewUser: boolean;
}

export class GoogleSignInDto {
  @ApiProperty({ description: 'The ID token from Google Identity Services' })
  @IsString()
  @Length(20, 4096)
  idToken: string;
}

export class VerifyPhoneDto {
  @ApiProperty({ example: '+998901234567' })
  @IsString()
  @Matches(UZ_PHONE, { message: "Telefon raqami +998XXXXXXXXX ko'rinishida bo'lishi kerak" })
  phone: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @Matches(/^\d{6}$/, { message: "Kod 6 ta raqamdan iborat bo'lishi kerak" })
  code: string;
}
