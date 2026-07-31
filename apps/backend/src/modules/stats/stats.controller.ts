import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { PriceTrend, SellerStats, StatsService } from './stats.service';

/** Categories the dashboard chart plots when the caller names none. */
const DEFAULT_TREND_CATEGORIES = ['sabzavotlar', 'mevalar', 'don-va-dukkak'];

@ApiTags('stats')
@Controller()
export class StatsController {
  constructor(private readonly stats: StatsService) {}

  @Get('me/stats')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Dashboard header figures for the signed-in seller' })
  sellerStats(@CurrentUser('sub') userId: string): Promise<SellerStats> {
    return this.stats.sellerStats(userId);
  }

  @Public()
  @Get('stats/price-trend')
  @ApiOperation({
    summary: 'Median price per category per month, computed from live listings',
  })
  @ApiQuery({ name: 'categories', required: false, description: 'Comma-separated slugs' })
  @ApiQuery({ name: 'regionId', required: false })
  priceTrend(
    @Query('categories') categories?: string,
    @Query('regionId') regionId?: string,
  ): Promise<PriceTrend> {
    const slugs = categories
      ?.split(',')
      .map((slug) => slug.trim())
      .filter(Boolean)
      .slice(0, 6);

    return this.stats.priceTrend(
      slugs?.length ? slugs : DEFAULT_TREND_CATEGORIES,
      regionId,
    );
  }
}
