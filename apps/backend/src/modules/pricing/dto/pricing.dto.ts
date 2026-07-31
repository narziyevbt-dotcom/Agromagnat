import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { QuantityUnit } from '../../catalog/units';

/**
 * Which population the recommendation was computed from. Returned to the client
 * and shown to the seller, because "12 000 so'm" with no provenance is a number
 * to argue with and "12 000 so'm, based on 34 sales in your district over the
 * last two months" is a number to trust.
 *
 * Ordered strongest to weakest — the estimator walks down this list and stops
 * at the first level with enough data.
 */
export enum PriceBasis {
  /** Listings actually marked sold in this category, region and unit. */
  SOLD_LOCAL = 'sold_local',
  /** Sold listings, widened to the whole country. */
  SOLD_NATIONAL = 'sold_national',
  /** Active listings — asking prices, not clearing prices. */
  ACTIVE_LOCAL = 'active_local',
  /** Active listings, widened to the whole country. */
  ACTIVE_NATIONAL = 'active_national',
}

export class SuggestPriceDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4', { message: 'Kategoriya tanlanmagan' })
  categoryId: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Omit for a national estimate',
  })
  @IsOptional()
  @IsUUID('4')
  regionId?: string;

  @ApiProperty({ enum: QuantityUnit, description: 'The unit the price is quoted per' })
  @IsEnum(QuantityUnit, { message: "O'lchov birligi tanlanmagan" })
  unit: QuantityUnit;

  @ApiPropertyOptional({
    description: 'Volume on offer. Large lots price below the median.',
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1_000_000_000)
  quantity?: number;
}

export class PriceRangeDto {
  @ApiProperty({ description: "25th percentile, in so'm", example: '11000.00' })
  min: string;

  @ApiProperty({ description: 'Median — the recommendation', example: '13500.00' })
  suggested: string;

  @ApiProperty({ description: '75th percentile', example: '16000.00' })
  max: string;
}

export class PriceSuggestionDto {
  @ApiProperty({
    type: PriceRangeDto,
    nullable: true,
    description: 'Null when there is not enough data to say anything honest',
  })
  range: PriceRangeDto | null;

  @ApiProperty({ enum: QuantityUnit })
  unit: QuantityUnit;

  @ApiProperty({
    enum: PriceBasis,
    nullable: true,
    description: 'Which population the numbers came from',
  })
  basis: PriceBasis | null;

  @ApiProperty({ description: 'How many listings the estimate was computed from' })
  sampleSize: number;

  @ApiProperty({
    description: '0-1. Falls with a small sample, a widened scope, or scattered prices.',
    example: 0.72,
  })
  confidence: number;

  @ApiProperty({
    description: 'Percent change vs 30 days ago, or null when unknown',
    nullable: true,
    example: -4.2,
  })
  trendPct: number | null;

  @ApiProperty({
    description: 'One Uzbek sentence the seller reads, generated from the numbers above',
    example: "Samarqandda so'nggi 60 kunda 34 ta sotuvga ko'ra 13 500 so'm/kg atrofida.",
  })
  reasonUz: string;
}

export class PriceIndexPointDto {
  @ApiProperty({ example: '2026-07-29' })
  day: string;

  @ApiProperty() priceMin: string;
  @ApiProperty() priceAvg: string;
  @ApiProperty() priceMax: string;
  @ApiProperty() sampleSize: number;
}

export class QueryPriceHistoryDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  categoryId: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  regionId?: string;

  @ApiPropertyOptional({ enum: QuantityUnit, default: QuantityUnit.KG })
  @IsOptional()
  @IsEnum(QuantityUnit)
  unit?: QuantityUnit;

  @ApiPropertyOptional({ minimum: 7, maximum: 365, default: 90 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(7)
  @Max(365)
  days?: number;
}
