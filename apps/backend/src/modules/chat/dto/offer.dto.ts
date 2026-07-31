import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Length,
  Max,
} from 'class-validator';
import { PriceUnit, QuantityUnit } from '../../catalog/units';

export class CreateOfferDto {
  @ApiProperty({ example: 12000, description: "Proposed price in so'm per priceUnit" })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: "Narx noto'g'ri" })
  @IsPositive({ message: "Narx noldan katta bo'lishi kerak" })
  @Max(100_000_000_000)
  amount: number;

  @ApiPropertyOptional({
    enum: PriceUnit,
    description: "Defaults to the listing's own price unit",
  })
  @IsOptional()
  @IsEnum(PriceUnit, { message: 'Narx birligi tanlanmagan' })
  priceUnit?: PriceUnit;

  @ApiPropertyOptional({ example: 5, description: 'Volume wanted; defaults to the whole listing' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 }, { message: "Hajm noto'g'ri" })
  @IsPositive({ message: "Hajm noldan katta bo'lishi kerak" })
  @Max(1_000_000_000)
  quantity?: number;

  @ApiPropertyOptional({ enum: QuantityUnit })
  @IsOptional()
  @IsEnum(QuantityUnit)
  quantityUnit?: QuantityUnit;

  @ApiPropertyOptional({ example: "O'zim olib ketaman" })
  @IsOptional()
  @IsString()
  @Length(1, 300)
  note?: string;
}

export class OfferPartyDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ nullable: true }) name: string | null;
}

export class OfferDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ format: 'uuid' }) chatId: string;
  @ApiProperty({ format: 'uuid' }) listingId: string;
  @ApiProperty({ enum: ['buyer', 'seller'] }) fromRole: 'buyer' | 'seller';
  @ApiProperty({ example: '12000.00' }) amount: string;
  @ApiProperty() priceUnit: string;
  @ApiProperty({ nullable: true }) quantity: string | null;
  @ApiProperty({ nullable: true }) quantityUnit: string | null;
  @ApiProperty({ nullable: true }) note: string | null;
  @ApiProperty({ enum: ['pending', 'accepted', 'declined', 'expired'] })
  status: 'pending' | 'accepted' | 'declined' | 'expired';

  @ApiProperty({ description: 'True when the caller is the one who has to answer it' })
  canRespond: boolean;

  @ApiProperty({ description: 'True when the caller made it' })
  isMine: boolean;

  @ApiProperty() createdAt: string;
  @ApiProperty({ nullable: true }) respondedAt: string | null;
}
