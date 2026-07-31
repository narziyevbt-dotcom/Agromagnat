import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import {
  PriceIndexPointDto,
  PriceSuggestionDto,
  QueryPriceHistoryDto,
  SuggestPriceDto,
} from './dto/pricing.dto';
import { PricingService } from './pricing.service';

/**
 * Public, unlike the AI endpoints.
 *
 * These are aggregates over listings that are themselves public, they cost a
 * cached percentile query rather than a model call, and a buyer checking
 * whether an asking price is fair is exactly who should be able to see them
 * without an account. The market index is the argument for the platform — the
 * one thing here a general classifieds site cannot show.
 */
@Public()
@ApiTags('pricing')
@Controller('pricing')
export class PricingController {
  constructor(private readonly pricing: PricingService) {}

  @Post('suggest')
  @ApiOperation({
    summary: "Recommended price for a category, region and unit, with its basis",
  })
  @ApiOkResponse({ type: PriceSuggestionDto })
  suggest(@Body() dto: SuggestPriceDto): Promise<PriceSuggestionDto> {
    return this.pricing.suggest(dto);
  }

  @Get('history')
  @ApiOperation({ summary: 'Daily index series behind the market-price chart' })
  @ApiOkResponse({ type: [PriceIndexPointDto] })
  history(@Query() query: QueryPriceHistoryDto): Promise<PriceIndexPointDto[]> {
    return this.pricing.history(query);
  }
}
