import { Inject, Injectable, Logger } from '@nestjs/common';
import { HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RedisService } from '../../redis/redis.service';
import { CatalogService } from '../catalog/catalog.service';
import { formSpecFor } from '../catalog/category-forms';
import { User } from '../users/entities/user.entity';
import {
  AI_SERVICE,
  AiService,
  AssistAnswer,
  AssistTurn,
  CategorySuggestion,
  DraftContext,
  ListingDraft,
  SearchIntent,
} from './ai.types';
import { describeIntent } from './search-intent';

/**
 * Per-user hourly ceilings. AI calls cost real money and the endpoints sit
 * behind a text box, so an accidental loop in a client is the likeliest way to
 * spend a month's budget in an afternoon. The numbers are generous for a person
 * and tight for a script.
 */
const LIMITS: Record<string, number> = {
  category: 120,
  draft: 30,
  assist: 60,
  search: 120,
};

const WINDOW_SECONDS = 3600;

/**
 * Everything the AI endpoints need that is not the model itself: the category
 * list, the seller's saved location, the field specs, and the rate limit.
 *
 * Kept apart from the providers so both of them stay pure — a provider takes
 * text and context and returns a result, and knows nothing about Redis, users
 * or HTTP.
 */
@Injectable()
export class AiFacade {
  private readonly logger = new Logger('AI');

  constructor(
    @Inject(AI_SERVICE) private readonly ai: AiService,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly catalog: CatalogService,
    private readonly redis: RedisService,
  ) {}

  async suggestCategory(userId: string, text: string): Promise<CategorySuggestion> {
    await this.assertWithinLimit(userId, 'category');
    return this.ai.suggestCategory(text, await this.contextFor(userId));
  }

  async draftListing(userId: string, text: string): Promise<ListingDraft> {
    await this.assertWithinLimit(userId, 'draft');
    const draft = await this.ai.draftListing(text, await this.contextFor(userId));
    this.logger.log(`draft (${draft.source}) for ${userId}: ${draft.categorySlug ?? 'no category'}`);
    return draft;
  }

  /**
   * A search sentence turned into the feed's filters.
   *
   * Rate-limited on the user when there is one and on the caller's IP when
   * there is not — search is the one AI surface that has to work signed out,
   * because a buyer evaluating the platform will not create an account first
   * and that first query is the whole pitch.
   */
  async parseSearch(actor: string, text: string): Promise<SearchIntent> {
    await this.assertWithinLimit(actor, 'search');

    const [context, regions] = await Promise.all([
      this.contextFor(actor),
      this.catalog.findRegions(),
    ]);

    const intent = await this.ai.parseSearch(text, {
      ...context,
      regions: regions.map((region) => ({
        id: region.id,
        slug: region.slug,
        nameUz: region.nameUz,
      })),
    });

    // Written here rather than by either provider: the sentence has to be
    // identical for identical filters whichever pass produced them, and it is
    // what the UI renders as removable chips.
    return { ...intent, summaryUz: describeIntent(intent) };
  }

  async assist(userId: string, question: string, history: AssistTurn[]): Promise<AssistAnswer> {
    await this.assertWithinLimit(userId, 'assist');
    return this.ai.assist(question, history);
  }

  private async contextFor(userId: string): Promise<DraftContext> {
    const [categories, user] = await Promise.all([
      this.catalog.findCategories(),
      // Anonymous search passes an IP rather than a user id, which simply
      // finds nothing — the seller's saved location is an optimisation, not a
      // requirement.
      this.users.findOne({ where: { id: userId } }).catch(() => null),
    ]);

    const kindBySlug = new Map(categories.map((category) => [category.slug, category.kind]));

    return {
      categories: categories.map((category) => ({
        id: category.id,
        slug: category.slug,
        nameUz: category.nameUz,
      })),
      specFor: (slug) => {
        const kind = kindBySlug.get(slug);
        return kind ? formSpecFor(kind) : null;
      },
      regionId: user?.regionId ?? null,
      districtId: user?.districtId ?? null,
    };
  }

  private async assertWithinLimit(userId: string, bucket: keyof typeof LIMITS): Promise<void> {
    const used = await this.redis.incrWithTtl(`ai:${bucket}:${userId}`, WINDOW_SECONDS);
    if (used > LIMITS[bucket]) {
      throw new HttpException(
        "AI yordamidan juda ko'p foydalandingiz. Bir soatdan keyin qayta urinib ko'ring.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }
}
