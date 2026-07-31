import { Body, Controller, Ip, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AiFacade } from './ai.facade';
import { AssistAnswer, CategorySuggestion, ListingDraft } from './ai.types';
import { Public } from '../auth/decorators/public.decorator';
import { ListingsService } from '../listings/listings.service';
import { AssistDto, DraftListingDto, SmartSearchDto, SuggestCategoryDto } from './dto/ai.dto';

/**
 * Authenticated on purpose, even though category suggestion would be useful to
 * an anonymous visitor: these calls cost money per request and the rate limit
 * is keyed on the user. Only somebody about to post a listing needs them, and
 * posting requires an account anyway.
 */
@ApiTags('ai')
@ApiBearerAuth()
@Controller('ai')
export class AiController {
  constructor(
    private readonly ai: AiFacade,
    private readonly listings: ListingsService,
  ) {}

  /**
   * Natural-language search. Public, unlike every other route here.
   *
   * A buyer evaluating the platform will not create an account before their
   * first query, and that query is the whole pitch — asking them to sign in
   * first would hide the one thing a keyword board cannot do. The rate limit
   * falls back to the caller's IP when there is no user to key it on.
   */
  @Public()
  @Post('search')
  @ApiOperation({ summary: 'Turn a sentence into feed filters and run it' })
  async smartSearch(
    @Body() dto: SmartSearchDto,
    @Ip() ip: string,
    @CurrentUser('sub') userId?: string,
  ) {
    const intent = await this.ai.parseSearch(userId ?? `ip:${ip}`, dto.q);

    const page = await this.listings.findAll(
      {
        ...(intent.categoryId ? { categoryId: intent.categoryId } : {}),
        ...(intent.regionId ? { regionId: intent.regionId } : {}),
        ...(intent.priceMin !== null ? { priceMin: intent.priceMin } : {}),
        ...(intent.priceMax !== null ? { priceMax: intent.priceMax } : {}),
        ...(intent.quantityMin !== null ? { quantityMin: intent.quantityMin } : {}),
        ...(intent.withDelivery ? { withDelivery: true } : {}),
        ...(intent.verifiedOnly ? { verifiedOnly: true } : {}),
        ...(intent.leftoverQ ? { q: intent.leftoverQ } : {}),
        sort: (intent.sort ?? 'newest') as never,
        limit: dto.limit ?? 20,
      },
      userId,
    );

    return { intent, ...page };
  }

  @Post('category')
  @ApiOperation({ summary: 'Suggest a category from what the seller typed' })
  suggestCategory(
    @CurrentUser('sub') userId: string,
    @Body() dto: SuggestCategoryDto,
  ): Promise<CategorySuggestion> {
    return this.ai.suggestCategory(userId, dto.text);
  }

  @Post('draft')
  @ApiOperation({
    summary: 'Turn one sentence — typed or dictated — into a filled listing draft',
  })
  draftListing(
    @CurrentUser('sub') userId: string,
    @Body() dto: DraftListingDto,
  ): Promise<ListingDraft> {
    return this.ai.draftListing(userId, dto.text);
  }

  @Post('assist')
  @ApiOperation({ summary: 'Answer a seller question about Agromagnat, in Uzbek' })
  @ApiOkResponse({ description: 'Uzbek answer' })
  assist(@CurrentUser('sub') userId: string, @Body() dto: AssistDto): Promise<AssistAnswer> {
    return this.ai.assist(userId, dto.question, dto.history ?? []);
  }
}
