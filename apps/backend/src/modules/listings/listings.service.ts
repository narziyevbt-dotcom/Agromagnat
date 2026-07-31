import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, In, Repository, SelectQueryBuilder } from 'typeorm';
import { RedisService } from '../../redis/redis.service';
import { StorageService } from '../storage/storage.service';
import { User } from '../users/entities/user.entity';
import { CreateListingDto, UpdateListingDto } from './dto/create-listing.dto';
import {
  ListingSort,
  PaginatedListingsDto,
  QueryListingsDto,
} from './dto/query-listings.dto';
import { Favorite } from './entities/favorite.entity';
import { ListingPhoto } from './entities/listing-photo.entity';
import { DeliveryOption, Listing, ListingStatus } from './entities/listing.entity';

/** Listings auto-archive this many days after publication. */
export const LISTING_TTL_DAYS = 14;

/** Photos per listing. */
export const MAX_PHOTOS = 5;

/** How long the first feed page is cached. */
export const FEED_CACHE_TTL_SECONDS = 60;

/**
 * 0 for a listing whose paid TOP placement is still live, 1 for everything
 * else. Defined once because the ORDER BY, the keyset predicate and the cursor
 * encoder all have to agree on it exactly.
 */
const PROMO_RANK_SQL =
  'CASE WHEN listing.is_promoted AND (listing.promoted_until IS NULL OR listing.promoted_until > NOW()) THEN 0 ELSE 1 END';

interface Cursor {
  /** Promotion rank of the last item on the previous page (0 or 1). */
  r: number;
  /** Sort key of the last item on the previous page. */
  v: string;
  /** Tie-breaker so rows sharing a sort value are never skipped or repeated. */
  id: string;
}

@Injectable()
export class ListingsService {
  private readonly logger = new Logger('Listings');

  constructor(
    @InjectRepository(Listing) private readonly listings: Repository<Listing>,
    @InjectRepository(ListingPhoto) private readonly photos: Repository<ListingPhoto>,
    @InjectRepository(Favorite) private readonly favorites: Repository<Favorite>,
    private readonly redis: RedisService,
    private readonly storage: StorageService,
    private readonly dataSource: DataSource,
  ) {}

  // ---------------------------------------------------------------- create

  async create(sellerId: string, dto: CreateListingDto): Promise<Listing> {
    this.assertWholesaleCoherent(dto);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + LISTING_TTL_DAYS);

    const listing = this.listings.create({
      ...dto,
      // numeric columns round-trip as strings so no value passes through a float.
      quantity: String(dto.quantity),
      price: String(dto.price),
      minOrder: dto.minOrder === undefined ? null : String(dto.minOrder),
      wholesalePrice: dto.wholesalePrice === undefined ? null : String(dto.wholesalePrice),
      description: dto.description ?? null,
      harvestDate: dto.harvestDate ?? null,
      delivery: dto.delivery ?? DeliveryOption.NONE,
      seasonMonths: dto.seasonMonths ?? [],
      sellerId,
      status: ListingStatus.ACTIVE,
      expiresAt,
    });

    const saved = await this.listings.save(listing);
    await this.invalidateFeedCache();
    return this.findOne(saved.id);
  }

  // ------------------------------------------------------------------ read

  /**
   * Feed and search. Uses keyset pagination rather than OFFSET: the feed is
   * append-heavy, and OFFSET both slows down linearly and drops rows when a new
   * listing lands between two page fetches.
   */
  async findAll(query: QueryListingsDto, viewerId?: string): Promise<PaginatedListingsDto<Listing>> {
    const cacheKey = this.feedCacheKey(query);
    if (cacheKey) {
      const cached = await this.redis.get<PaginatedListingsDto<Listing>>(cacheKey);
      if (cached) {
        return this.decorateFavorites(cached, viewerId);
      }
    }

    const limit = query.limit ?? 20;

    // Two-phase read. Phase one orders and pages over the listings table alone,
    // so the ranking expression is free of the joined collections; phase two
    // hydrates only the rows that survived. Doing it in one joined query would
    // both multiply rows by the photo count and defeat the feed index.
    const ids = await this.selectPageIds(query, limit);
    const hasMore = ids.length > limit;
    const pageIds = hasMore ? ids.slice(0, limit) : ids;
    const items = await this.hydrate(pageIds);

    const result: PaginatedListingsDto<Listing> = {
      items,
      hasMore,
      nextCursor: hasMore ? this.encodeCursor(items[items.length - 1], query.sort) : null,
    };

    if (cacheKey) {
      await this.redis.set(cacheKey, result, FEED_CACHE_TTL_SECONDS);
    }
    return this.decorateFavorites(result, viewerId);
  }

  async findOne(id: string): Promise<Listing> {
    const listing = await this.listings.findOne({
      where: { id },
      relations: {
        seller: true,
        category: true,
        region: true,
        district: true,
        photos: true,
      },
      order: { photos: { sortOrder: 'ASC' } },
    });

    if (!listing) {
      throw new NotFoundException("E'lon topilmadi");
    }
    return listing;
  }

  /** Detail view. Blocked and deleted listings stay hidden from everyone but their owner. */
  async findOneForViewer(id: string, viewerId?: string): Promise<Listing> {
    const listing = await this.findOne(id);
    const isOwner = viewerId !== undefined && listing.sellerId === viewerId;

    if (listing.status === ListingStatus.BLOCKED && !isOwner) {
      throw new NotFoundException("E'lon topilmadi");
    }

    if (!isOwner) {
      // Fire-and-forget: a view counter must never slow down or fail the read.
      void this.listings
        .increment({ id }, 'viewCount', 1)
        .catch((error) => this.logger.warn(`viewCount failed for ${id}: ${String(error)}`));
      listing.viewCount += 1;
    }

    return listing;
  }

  // ---------------------------------------------------------------- update

  async update(id: string, userId: string, dto: UpdateListingDto): Promise<Listing> {
    const listing = await this.assertOwned(id, userId);
    this.assertWholesaleCoherent({ ...listing, ...dto } as CreateListingDto);

    Object.assign(listing, {
      ...dto,
      quantity: dto.quantity === undefined ? listing.quantity : String(dto.quantity),
      price: dto.price === undefined ? listing.price : String(dto.price),
      minOrder:
        dto.minOrder === undefined ? listing.minOrder : String(dto.minOrder),
      wholesalePrice:
        dto.wholesalePrice === undefined
          ? listing.wholesalePrice
          : String(dto.wholesalePrice),
    });

    await this.listings.save(listing);
    await this.invalidateFeedCache();
    return this.findOne(id);
  }

  async markSold(id: string, userId: string): Promise<Listing> {
    const listing = await this.assertOwned(id, userId);

    if (listing.status === ListingStatus.SOLD) {
      return listing;
    }

    await this.dataSource.transaction(async (manager) => {
      await manager.update(Listing, id, {
        status: ListingStatus.SOLD,
        soldAt: new Date(),
      });
      await manager.increment(User, { id: listing.sellerId }, 'salesCount', 1);
    });

    await this.invalidateFeedCache();
    return this.findOne(id);
  }

  async remove(id: string, userId: string): Promise<void> {
    const listing = await this.assertOwned(id, userId);
    // Soft delete — chats, reviews and the price index all reference this row.
    await this.listings.softDelete(listing.id);
    await this.invalidateFeedCache();
  }

  /** Counts a tap on "Qo'ng'iroq qilish" — the product's north-star metric. */
  async registerCall(id: string): Promise<{ callCount: number }> {
    const listing = await this.listings.findOne({
      where: { id },
      select: { id: true, callCount: true },
    });
    if (!listing) {
      throw new NotFoundException("E'lon topilmadi");
    }
    await this.listings.increment({ id }, 'callCount', 1);
    return { callCount: listing.callCount + 1 };
  }

  // ---------------------------------------------------------------- photos

  async addPhotos(
    listingId: string,
    userId: string,
    files: Array<{ buffer: Buffer; mimetype: string; size: number }>,
  ): Promise<ListingPhoto[]> {
    await this.assertOwned(listingId, userId);

    const existing = await this.photos.count({ where: { listingId } });
    if (existing + files.length > MAX_PHOTOS) {
      throw new BadRequestException(`Ko'pi bilan ${MAX_PHOTOS} ta rasm yuklash mumkin`);
    }

    const saved: ListingPhoto[] = [];
    for (const [index, file] of files.entries()) {
      const stored = await this.storage.storeListingPhoto(listingId, file);
      saved.push(
        await this.photos.save(
          this.photos.create({
            listingId,
            objectKey: stored.objectKey,
            url: stored.url,
            thumbUrl: stored.thumbUrl,
            width: stored.width,
            height: stored.height,
            sizeBytes: stored.sizeBytes,
            sortOrder: existing + index,
          }),
        ),
      );
    }

    await this.invalidateFeedCache();
    return saved;
  }

  async removePhoto(listingId: string, photoId: string, userId: string): Promise<void> {
    await this.assertOwned(listingId, userId);
    const photo = await this.photos.findOne({ where: { id: photoId, listingId } });
    if (!photo) {
      throw new NotFoundException('Rasm topilmadi');
    }

    await this.photos.delete(photo.id);
    await this.storage.remove(photo.objectKey);
    await this.invalidateFeedCache();
  }

  // ------------------------------------------------------------- favorites

  async addFavorite(listingId: string, userId: string): Promise<void> {
    const listing = await this.listings.findOne({ where: { id: listingId } });
    if (!listing) {
      throw new NotFoundException("E'lon topilmadi");
    }

    const existing = await this.favorites.findOne({ where: { listingId, userId } });
    if (existing) {
      return;
    }

    await this.favorites.save(this.favorites.create({ listingId, userId }));
    await this.listings.increment({ id: listingId }, 'favoriteCount', 1);
  }

  async removeFavorite(listingId: string, userId: string): Promise<void> {
    const result = await this.favorites.delete({ listingId, userId });
    if (result.affected) {
      await this.listings.decrement({ id: listingId }, 'favoriteCount', 1);
    }
  }

  async findFavorites(userId: string, limit = 50): Promise<Listing[]> {
    const rows = await this.favorites.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
    if (!rows.length) {
      return [];
    }

    const listings = await this.baseQuery(false)
      .andWhere('listing.id IN (:...ids)', { ids: rows.map((r) => r.listingId) })
      .getMany();

    // Preserve "most recently favorited first" — the IN clause does not.
    const order = new Map(rows.map((row, index) => [row.listingId, index]));
    return listings
      .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
      .map((listing) => Object.assign(listing, { isFavorite: true }));
  }

  // ------------------------------------------------------------- lifecycle

  /**
   * Archives listings past their expiry. Invoked by a cron job; returns the
   * number archived so the caller can log it.
   */
  async expireStale(): Promise<number> {
    const result = await this.listings
      .createQueryBuilder()
      .update(Listing)
      .set({ status: ListingStatus.EXPIRED })
      .where('status = :active', { active: ListingStatus.ACTIVE })
      .andWhere('expires_at IS NOT NULL AND expires_at < NOW()')
      .execute();

    const count = result.affected ?? 0;
    if (count > 0) {
      await this.invalidateFeedCache();
    }
    return count;
  }

  // ---------------------------------------------------------------- helpers

  /**
   * Phase one: ordered, filtered, keyset-paginated ids. One extra row is taken
   * so the caller learns whether another page exists without a COUNT.
   */
  private async selectPageIds(query: QueryListingsDto, limit: number): Promise<string[]> {
    const qb = this.listings
      .createQueryBuilder('listing')
      .select('listing.id', 'id')
      .where('listing.deleted_at IS NULL');

    if (query.sellerId) {
      // "My listings" shows every status; the public feed only shows active.
      qb.andWhere('listing.seller_id = :sellerId', { sellerId: query.sellerId });
    } else {
      qb.andWhere('listing.status = :status', { status: ListingStatus.ACTIVE });
    }

    if (query.verifiedOnly) {
      qb.innerJoin('listing.seller', 'seller').andWhere('seller.is_verified = true');
    }

    this.applyFilters(qb, query);
    this.applySearch(qb, query.q);
    this.applySort(qb, query.sort ?? ListingSort.NEWEST, query.cursor);

    const rows = await qb.limit(limit + 1).getRawMany<{ id: string }>();
    return rows.map((row) => row.id);
  }

  /** Phase two: load the page's rows with their relations, preserving order. */
  private async hydrate(ids: string[]): Promise<Listing[]> {
    if (!ids.length) {
      return [];
    }

    const rows = await this.listings.find({
      where: { id: In(ids) },
      relations: {
        photos: true,
        category: true,
        region: true,
        district: true,
        seller: true,
      },
      order: { photos: { sortOrder: 'ASC' } },
    });

    const position = new Map(ids.map((id, index) => [id, index]));
    return rows.sort((a, b) => (position.get(a.id) ?? 0) - (position.get(b.id) ?? 0));
  }

  private baseQuery(onlyActive = true): SelectQueryBuilder<Listing> {
    const qb = this.listings
      .createQueryBuilder('listing')
      .leftJoinAndSelect('listing.photos', 'photo')
      .leftJoinAndSelect('listing.category', 'category')
      .leftJoinAndSelect('listing.region', 'region')
      .leftJoinAndSelect('listing.district', 'district')
      .leftJoinAndSelect('listing.seller', 'seller');

    if (onlyActive) {
      qb.where('listing.status = :status', { status: ListingStatus.ACTIVE });
    }
    return qb;
  }

  private applyFilters(qb: SelectQueryBuilder<Listing>, query: QueryListingsDto): void {
    if (query.categoryId) {
      qb.andWhere('listing.category_id = :categoryId', { categoryId: query.categoryId });
    }
    if (query.regionId) {
      qb.andWhere('listing.region_id = :regionId', { regionId: query.regionId });
    }
    if (query.districtId) {
      qb.andWhere('listing.district_id = :districtId', { districtId: query.districtId });
    }
    if (query.sellerId) {
      qb.andWhere('listing.seller_id = :sellerId', { sellerId: query.sellerId });
    }
    if (query.priceMin !== undefined) {
      qb.andWhere('listing.price >= :priceMin', { priceMin: query.priceMin });
    }
    if (query.priceMax !== undefined) {
      qb.andWhere('listing.price <= :priceMax', { priceMax: query.priceMax });
    }
    if (query.quantityMin !== undefined) {
      qb.andWhere('listing.quantity >= :quantityMin', { quantityMin: query.quantityMin });
    }
    if (query.withDelivery) {
      qb.andWhere('listing.delivery IN (:...deliveryModes)', {
        deliveryModes: [DeliveryOption.DELIVERY, DeliveryOption.BOTH],
      });
    }
    if (query.delivery) {
      qb.andWhere('listing.delivery = :delivery', { delivery: query.delivery });
    }
  }

  /**
   * Prefix-matched full-text, with fuzzy word matching as a safety net.
   *
   * Both halves are shaped by one fact: Postgres has no Uzbek stemmer, so the
   * index is built with the 'simple' configuration and stores words exactly as
   * written. Uzbek is agglutinative — a listing says "pomidori", a buyer types
   * "pomidor" — so an exact-match query misses the most ordinary search there
   * is. Every term therefore becomes a prefix query, which is the standard
   * substitute for a stemmer.
   *
   * Terms are reduced to word characters and recombined by hand rather than
   * passed to websearch_to_tsquery, because that function has no prefix syntax;
   * to_tsquery does, and sanitising first keeps its parser from ever seeing an
   * operator a user typed.
   *
   * The second arm uses word_similarity rather than similarity: similarity
   * scores whole strings, so a 7-character query against a 30-character title
   * scores far below any useful threshold no matter how well it matches one
   * word inside it.
   */
  private applySearch(qb: SelectQueryBuilder<Listing>, q?: string): void {
    const raw = q?.trim();
    if (!raw) {
      return;
    }

    const words = raw
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((word) => word.length > 0)
      .slice(0, 8);

    qb.andWhere(
      new Brackets((where) => {
        if (words.length) {
          where.where(
            "listing.search_vector @@ to_tsquery('simple', :tsquery)",
            { tsquery: words.map((word) => `${word}:*`).join(' & ') },
          );
          where.orWhere('word_similarity(:term, listing.title) > 0.5', { term: raw });
        } else {
          // Nothing usable survived sanitising (punctuation or emoji only) —
          // fall back to fuzzy matching rather than matching everything.
          where.where('word_similarity(:term, listing.title) > 0.5', { term: raw });
        }
      }),
    );
  }

  /**
   * Ordering plus the keyset predicate.
   *
   * Paid TOP placement sorts ahead of everything else, so the promotion rank is
   * part of the sort key — and therefore has to be part of the cursor too. Left
   * out of the cursor, the jump from the last promoted row to the first ordinary
   * one would carry the promoted row's timestamp into the next page's filter and
   * silently drop every ordinary listing newer than it.
   *
   * The directions are mixed (rank ascending, recency descending), which rules
   * out a single row-value comparison; the branches are spelled out instead.
   */
  private applySort(
    qb: SelectQueryBuilder<Listing>,
    sort: ListingSort,
    cursor?: string,
  ): void {
    const decoded = cursor ? this.decodeCursor(cursor) : null;

    qb.addSelect(PROMO_RANK_SQL, 'promo_rank').addOrderBy('promo_rank', 'ASC');

    const ascending = sort === ListingSort.CHEAPEST;
    const byPrice = sort === ListingSort.CHEAPEST || sort === ListingSort.EXPENSIVE;

    const column = byPrice ? 'listing.price' : 'listing.created_at';
    const cast = byPrice ? 'numeric' : 'timestamptz';
    const comparison = ascending ? '>' : '<';
    const direction = ascending ? 'ASC' : 'DESC';

    if (decoded) {
      qb.andWhere(
        new Brackets((where) => {
          where
            .where(`${PROMO_RANK_SQL} > :cursorRank`, { cursorRank: decoded.r })
            .orWhere(
              new Brackets((same) => {
                same
                  .where(`${PROMO_RANK_SQL} = :cursorRank`, { cursorRank: decoded.r })
                  .andWhere(
                    `(${column}, listing.id) ${comparison} (:cursorValue::${cast}, :cursorId::uuid)`,
                    { cursorValue: decoded.v, cursorId: decoded.id },
                  );
              }),
            );
        }),
      );
    }

    qb.addOrderBy(column, direction).addOrderBy('listing.id', direction);
  }

  private encodeCursor(listing: Listing, sort?: ListingSort): string {
    const byPrice = sort === ListingSort.CHEAPEST || sort === ListingSort.EXPENSIVE;
    const payload: Cursor = {
      r: this.promoRank(listing),
      v: byPrice ? listing.price : listing.createdAt.toISOString(),
      id: listing.id,
    };
    return Buffer.from(JSON.stringify(payload)).toString('base64url');
  }

  /** Mirrors PROMO_RANK_SQL in TypeScript so the cursor agrees with the query. */
  private promoRank(listing: Listing): number {
    const live =
      listing.isPromoted &&
      (listing.promotedUntil === null || listing.promotedUntil.getTime() > Date.now());
    return live ? 0 : 1;
  }

  private decodeCursor(cursor: string): Cursor | null {
    try {
      const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString()) as Cursor;
      const valid =
        typeof parsed?.v === 'string' &&
        typeof parsed?.id === 'string' &&
        (parsed.r === 0 || parsed.r === 1);
      return valid ? parsed : null;
    } catch {
      // A malformed cursor should restart the feed, not 500 the request.
      return null;
    }
  }

  /**
   * Only the unfiltered first page is cached. That is the screen everyone opens
   * and the one worth protecting; caching every filter permutation would fill
   * Redis with entries read once.
   */
  private feedCacheKey(query: QueryListingsDto): string | null {
    const isDefaultFeed =
      !query.cursor &&
      !query.q &&
      !query.categoryId &&
      !query.districtId &&
      !query.sellerId &&
      query.priceMin === undefined &&
      query.priceMax === undefined &&
      query.quantityMin === undefined &&
      !query.verifiedOnly &&
      !query.withDelivery &&
      !query.delivery &&
      (query.sort ?? ListingSort.NEWEST) === ListingSort.NEWEST;

    if (!isDefaultFeed) {
      return null;
    }
    return `feed:v1:${query.regionId ?? 'all'}:${query.limit ?? 20}`;
  }

  private async invalidateFeedCache(): Promise<void> {
    await this.redis.delByPattern('feed:v1:*');
  }

  /** Marks which items the caller has already saved, in one query. */
  private async decorateFavorites(
    page: PaginatedListingsDto<Listing>,
    viewerId?: string,
  ): Promise<PaginatedListingsDto<Listing>> {
    if (!viewerId || !page.items.length) {
      return page;
    }

    const saved = await this.favorites.find({
      where: { userId: viewerId, listingId: In(page.items.map((item) => item.id)) },
      select: { listingId: true },
    });
    const savedIds = new Set(saved.map((row) => row.listingId));

    return {
      ...page,
      items: page.items.map((item) =>
        Object.assign(item, { isFavorite: savedIds.has(item.id) }),
      ),
    };
  }

  private async assertOwned(id: string, userId: string): Promise<Listing> {
    const listing = await this.listings.findOne({ where: { id } });
    if (!listing) {
      throw new NotFoundException("E'lon topilmadi");
    }
    if (listing.sellerId !== userId) {
      throw new ForbiddenException("Bu e'lon sizniki emas");
    }
    return listing;
  }

  /** A wholesale price only means something below the retail price. */
  private assertWholesaleCoherent(dto: Partial<CreateListingDto>): void {
    if (dto.wholesalePrice !== undefined && dto.wholesalePrice !== null && dto.minOrder == null) {
      throw new BadRequestException(
        "Ulgurji narx uchun minimal partiya ko'rsatilishi kerak",
      );
    }
    if (
      dto.wholesalePrice != null &&
      dto.price != null &&
      Number(dto.wholesalePrice) >= Number(dto.price)
    ) {
      throw new BadRequestException("Ulgurji narx oddiy narxdan past bo'lishi kerak");
    }
  }
}
