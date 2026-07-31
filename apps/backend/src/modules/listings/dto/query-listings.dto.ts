import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
} from 'class-validator';
import { DeliveryOption } from '../entities/listing.entity';

export enum ListingSort {
  NEWEST = 'newest',
  CHEAPEST = 'cheapest',
  EXPENSIVE = 'expensive',
}

const toBoolean = ({ value }: { value: unknown }): unknown =>
  value === undefined ? undefined : ['true', '1', true, 1].includes(value as never);

export class QueryListingsDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  categoryId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  regionId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  districtId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: "Filter to one seller's listings" })
  @IsOptional()
  @IsUUID('4')
  sellerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  priceMin?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  priceMax?: number;

  @ApiPropertyOptional({ description: 'Wholesale filter — minimum available volume' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  quantityMin?: number;

  @ApiPropertyOptional({ description: 'Only sellers with the verified badge' })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  verifiedOnly?: boolean;

  @ApiPropertyOptional({ description: 'Only listings offering delivery' })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  withDelivery?: boolean;

  @ApiPropertyOptional({ enum: DeliveryOption })
  @IsOptional()
  @IsEnum(DeliveryOption)
  delivery?: DeliveryOption;

  @ApiPropertyOptional({ description: 'Free-text query (full-text + trigram fallback)' })
  @IsOptional()
  @IsString()
  @Length(1, 120)
  q?: string;

  @ApiPropertyOptional({ enum: ListingSort, default: ListingSort.NEWEST })
  @IsOptional()
  @IsEnum(ListingSort)
  sort?: ListingSort = ListingSort.NEWEST;

  @ApiPropertyOptional({ description: 'Opaque cursor from the previous page' })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({ default: 20, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;
}

export class PaginatedListingsDto<T> {
  @ApiProperty({ isArray: true })
  items: T[];

  @ApiProperty({ nullable: true, description: 'Pass back as ?cursor= for the next page' })
  nextCursor: string | null;

  @ApiProperty({ description: 'True when another page exists' })
  hasMore: boolean;
}
