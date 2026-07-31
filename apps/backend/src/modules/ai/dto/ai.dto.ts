import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class SuggestCategoryDto {
  @ApiProperty({ example: '12 tonna pomidor' })
  @IsString()
  @Length(2, 400, { message: "Matn 2 tadan 400 tagacha belgidan iborat bo'lsin" })
  text: string;
}

export class DraftListingDto {
  @ApiProperty({
    example: "Urgutdan 12 tonna pomidorim bor, kilosi 14 ming so'mdan beraman",
    description: 'Typed or dictated — the voice flow transcribes first, then posts here',
  })
  @IsString()
  @Length(10, 2000, { message: "Kamida 10 ta belgi yozing" })
  text: string;
}

export class AssistTurnDto {
  @ApiProperty({ enum: ['user', 'assistant'] })
  @IsIn(['user', 'assistant'])
  role: 'user' | 'assistant';

  @ApiProperty()
  @IsString()
  @Length(1, 2000)
  content: string;
}

export class AssistDto {
  @ApiProperty({ example: "E'lon qancha muddat turadi?" })
  @IsString()
  @Length(2, 500)
  question: string;

  @ApiPropertyOptional({ type: [AssistTurnDto], description: 'Recent turns, oldest first' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => AssistTurnDto)
  history?: AssistTurnDto[];
}

export class SmartSearchDto {
  @ApiProperty({ example: "Samarqanddan 5 tonnadan ko'p oq kartoshka, 10 mingdan arzon" })
  @IsString()
  @Length(2, 300, { message: "So'rov 2 tadan 300 tagacha belgidan iborat bo'lsin" })
  q: string;

  @ApiPropertyOptional({ default: 20, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}
