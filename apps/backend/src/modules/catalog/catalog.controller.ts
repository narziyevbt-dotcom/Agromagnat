import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { District } from '../geo/entities/district.entity';
import { Region } from '../geo/entities/region.entity';
import { CatalogService } from './catalog.service';
import { Category } from './entities/category.entity';

// Reference data is needed before login — the web search page and the mobile
// region picker both render it to anonymous visitors.
@Public()
@ApiTags('catalog')
@Controller()
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('categories')
  @ApiOperation({ summary: 'All 12 agro categories' })
  @ApiOkResponse({ type: [Category] })
  findCategories(): Promise<Category[]> {
    return this.catalog.findCategories();
  }

  @Get('regions')
  @ApiOperation({ summary: 'All 14 regions of Uzbekistan' })
  @ApiOkResponse({ type: [Region] })
  findRegions(): Promise<Region[]> {
    return this.catalog.findRegions();
  }

  @Get('regions/:regionId/districts')
  @ApiOperation({ summary: 'Districts of a region (region -> district cascade)' })
  @ApiOkResponse({ type: [District] })
  findDistricts(@Param('regionId', ParseUUIDPipe) regionId: string): Promise<District[]> {
    return this.catalog.findDistricts(regionId);
  }
}
