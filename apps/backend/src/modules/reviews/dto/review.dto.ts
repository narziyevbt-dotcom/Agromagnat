import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';
import { Review } from '../entities/review.entity';

export class CreateReviewDto {
  @ApiProperty({ minimum: 1, maximum: 5 })
  @Type(() => Number)
  @IsInt({ message: "Baho 1 dan 5 gacha bo'lishi kerak" })
  @Min(1, { message: "Baho 1 dan 5 gacha bo'lishi kerak" })
  @Max(5, { message: "Baho 1 dan 5 gacha bo'lishi kerak" })
  rating: number;

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @Length(0, 1000, { message: "Izoh 1000 ta belgidan oshmasligi kerak" })
  comment?: string;
}

/**
 * Star histogram, keyed 1..5. A single average hides the difference between a
 * seller with twenty fives and one whose fives cancel out a row of ones, and
 * that difference is exactly what a buyer is looking for.
 */
export type RatingBreakdown = Record<'1' | '2' | '3' | '4' | '5', number>;

export class SellerReviewsDto {
  @ApiProperty({ type: Review, isArray: true }) items: Review[];
  @ApiProperty() total: number;
  @ApiProperty({ example: '4.70', description: 'Two decimals, as stored' })
  average: string;
  @ApiProperty({ example: { '1': 0, '2': 1, '3': 0, '4': 4, '5': 12 } })
  breakdown: RatingBreakdown;
}
