import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Length, Matches, Max, Min } from 'class-validator';

export class SendMessageDto {
  @ApiProperty({ maxLength: 2000 })
  @IsString()
  @Length(1, 2000, { message: "Xabar 1 tadan 2000 tagacha belgi bo'lishi kerak" })
  body: string;

  @ApiPropertyOptional({
    description:
      'Client-generated id. A message composed offline and retried on reconnect ' +
      'is stored once, and the retry returns the message already stored.',
  })
  @IsOptional()
  @IsString()
  @Length(8, 64)
  @Matches(/^[A-Za-z0-9_-]+$/, { message: "clientId noto'g'ri formatda" })
  clientId?: string;
}

export class QueryMessagesDto {
  @ApiPropertyOptional({ description: 'Opaque cursor from the previous page' })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

/** The other party in a conversation, as the viewer sees them. */
export class ChatParticipantDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ nullable: true }) name: string | null;
  @ApiProperty() phone: string;
  @ApiProperty() isVerified: boolean;
}

export class ChatSummaryDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ format: 'uuid' }) listingId: string;
  @ApiProperty() listingTitle: string;
  @ApiProperty({ nullable: true }) listingPhotoUrl: string | null;
  @ApiProperty({ nullable: true }) listingPrice: string | null;
  @ApiProperty({ nullable: true }) listingPriceUnit: string | null;
  @ApiProperty({ type: ChatParticipantDto }) counterpart: ChatParticipantDto;
  @ApiProperty({ description: 'Viewer\'s side of this conversation', enum: ['buyer', 'seller'] })
  role: 'buyer' | 'seller';
  @ApiProperty({ nullable: true }) lastMessageText: string | null;
  @ApiProperty({ nullable: true }) lastMessageAt: string | null;
  @ApiProperty() unreadCount: number;
}

export class MessagePageDto {
  @ApiProperty({ isArray: true }) items: unknown[];
  @ApiProperty({ nullable: true }) nextCursor: string | null;
  @ApiProperty() hasMore: boolean;
}
