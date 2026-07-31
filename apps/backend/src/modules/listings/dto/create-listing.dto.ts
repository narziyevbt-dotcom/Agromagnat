import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
} from 'class-validator';
import { QuantityUnit } from '../../catalog/entities/category.entity';
import { DeliveryOption, PriceUnit } from '../entities/listing.entity';

export class CreateListingDto {
  @ApiProperty({ example: 'Urgut pomidori, birinchi navli' })
  @IsString()
  @Length(5, 160, { message: "Sarlavha 5 tadan 160 tagacha belgidan iborat bo'lishi kerak" })
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 4000)
  description?: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID('4', { message: 'Kategoriya tanlanmagan' })
  categoryId: string;

  @ApiProperty({ example: 12, description: 'Available volume' })
  @IsNumber({ maxDecimalPlaces: 3 }, { message: "Hajm noto'g'ri" })
  @IsPositive({ message: "Hajm noldan katta bo'lishi kerak" })
  @Max(1_000_000_000)
  quantity: number;

  @ApiProperty({ enum: QuantityUnit })
  @IsEnum(QuantityUnit, { message: "O'lchov birligi tanlanmagan" })
  quantityUnit: QuantityUnit;

  @ApiProperty({ example: 14000, description: "Price in so'm per priceUnit" })
  @IsNumber({ maxDecimalPlaces: 2 }, { message: "Narx noto'g'ri" })
  @IsPositive({ message: "Narx noldan katta bo'lishi kerak" })
  @Max(100_000_000_000)
  price: number;

  @ApiProperty({ enum: PriceUnit })
  @IsEnum(PriceUnit, { message: 'Narx birligi tanlanmagan' })
  priceUnit: PriceUnit;

  @ApiPropertyOptional({ description: 'Minimum wholesale lot' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @IsPositive()
  minOrder?: number;

  @ApiPropertyOptional({ description: 'Discounted price at or above minOrder' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  wholesalePrice?: number;

  @ApiProperty({ format: 'uuid' })
  @IsUUID('4', { message: 'Viloyat tanlanmagan' })
  regionId: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID('4', { message: 'Tuman tanlanmagan' })
  districtId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng?: number;

  @ApiPropertyOptional({ example: '2026-07-28' })
  @IsOptional()
  @IsDateString({}, { message: "Sana noto'g'ri" })
  harvestDate?: string;

  @ApiPropertyOptional({ enum: DeliveryOption })
  @IsOptional()
  @IsEnum(DeliveryOption)
  delivery?: DeliveryOption;

  @ApiPropertyOptional({ example: [7, 8, 9], description: 'Season months, 1-12' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(12, { each: true })
  @Type(() => Number)
  seasonMonths?: number[];

  /**
   * Category-specific answers. The shape is not fixed here because it depends
   * on the category — `ListingsService` checks it against that category's field
   * spec, which is also what the client rendered the inputs from.
   */
  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    example: { condition: 'used', year: 2018 },
  })
  @IsOptional()
  @IsObject({ message: "Qo'shimcha maydonlar noto'g'ri" })
  attributes?: Record<string, unknown>;
}

export class UpdateListingDto extends PartialType(CreateListingDto) {}
