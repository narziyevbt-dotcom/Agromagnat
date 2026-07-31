import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AiFacade } from './ai.facade';
import { AssistAnswer, CategorySuggestion, ListingDraft } from './ai.types';
import { AssistDto, DraftListingDto, SuggestCategoryDto } from './dto/ai.dto';

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
  constructor(private readonly ai: AiFacade) {}

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
