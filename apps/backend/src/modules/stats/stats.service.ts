import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RedisService } from '../../redis/redis.service';
import { Category } from '../catalog/entities/category.entity';
import { Listing, ListingStatus } from '../listings/entities/listing.entity';

/** Months of history the dashboard chart shows. */
const TREND_MONTHS = 6;

const TREND_CACHE_TTL_SECONDS = 900;

export interface SellerStats {
  activeListings: number;
  totalViews: number;
  totalCalls: number;
  /** Median price across the seller's active listings, in so'm. */
  avgPrice: string | null;
  avgPriceUnit: string | null;
  /** Percent change in views against the previous 30 days. */
  viewsTrendPct: number | null;
}

export interface TrendPoint {
  /** "2026-07" */
  month: string;
  /** Median price per category slug for that month; absent when no data. */
  values: Record<string, number | null>;
}

export interface PriceTrend {
  categories: Array<{ slug: string; nameUz: string }>;
  points: TrendPoint[];
}

@Injectable()
export class StatsService {
  constructor(
    @InjectRepository(Listing) private readonly listings: Repository<Listing>,
    @InjectRepository(Category) private readonly categories: Repository<Category>,
    private readonly redis: RedisService,
  ) {}

  /**
   * Dashboard header numbers for one seller.
   *
   * Aggregated in SQL rather than by loading rows: a seller with hundreds of
   * listings should still cost one round trip.
   */
  async sellerStats(sellerId: string): Promise<SellerStats> {
    const totals = await this.listings
      .createQueryBuilder('listing')
      .select('COUNT(*) FILTER (WHERE listing.status = :active)', 'activeListings')
      .addSelect('COALESCE(SUM(listing.view_count), 0)', 'totalViews')
      .addSelect('COALESCE(SUM(listing.call_count), 0)', 'totalCalls')
      .where('listing.seller_id = :sellerId', { sellerId })
      .andWhere('listing.deleted_at IS NULL')
      .setParameter('active', ListingStatus.ACTIVE)
      .getRawOne<{ activeListings: string; totalViews: string; totalCalls: string }>();

    // Median rather than mean: one mis-typed price should not move the number
    // a farmer reads as "what my produce is worth".
    const median = await this.listings
      .createQueryBuilder('listing')
      .select(
        'PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY listing.price)',
        'medianPrice',
      )
      .addSelect('MODE() WITHIN GROUP (ORDER BY listing.price_unit)', 'unit')
      .where('listing.seller_id = :sellerId', { sellerId })
      .andWhere('listing.status = :active', { active: ListingStatus.ACTIVE })
      .andWhere('listing.deleted_at IS NULL')
      .getRawOne<{ medianPrice: string | null; unit: string | null }>();

    const viewsTrendPct = await this.viewsTrend(sellerId);

    return {
      activeListings: Number(totals?.activeListings ?? 0),
      totalViews: Number(totals?.totalViews ?? 0),
      totalCalls: Number(totals?.totalCalls ?? 0),
      avgPrice: median?.medianPrice ? Number(median.medianPrice).toFixed(2) : null,
      avgPriceUnit: median?.unit ?? null,
      viewsTrendPct,
    };
  }

  /**
   * Views on listings published in the last 30 days against the 30 before that.
   *
   * This is a proxy, and an honest one: per-listing view counts are cumulative
   * totals with no time dimension, so there is no way to attribute a view to a
   * month. Returns null rather than a fabricated number when either window is
   * empty. A real time series arrives with the analytics events work.
   */
  private async viewsTrend(sellerId: string): Promise<number | null> {
    const row = await this.listings
      .createQueryBuilder('listing')
      .select(
        "COALESCE(SUM(listing.view_count) FILTER (WHERE listing.created_at >= NOW() - INTERVAL '30 days'), 0)",
        'recent',
      )
      .addSelect(
        "COALESCE(SUM(listing.view_count) FILTER (WHERE listing.created_at >= NOW() - INTERVAL '60 days' AND listing.created_at < NOW() - INTERVAL '30 days'), 0)",
        'previous',
      )
      .where('listing.seller_id = :sellerId', { sellerId })
      .andWhere('listing.deleted_at IS NULL')
      .getRawOne<{ recent: string; previous: string }>();

    const recent = Number(row?.recent ?? 0);
    const previous = Number(row?.previous ?? 0);

    if (previous === 0) {
      return null;
    }
    return Math.round(((recent - previous) / previous) * 1000) / 10;
  }

  /**
   * Median price per category per month, computed from the listings themselves.
   *
   * The price_index table exists for a nightly job to fill, but nothing writes
   * to it yet — so this reads the source data directly. It is the same
   * aggregate that job will store, which means the chart is correct today and
   * the query is the one that gets moved into the cron later.
   */
  async priceTrend(categorySlugs: string[], regionId?: string): Promise<PriceTrend> {
    const cacheKey = `trend:v1:${categorySlugs.sort().join(',')}:${regionId ?? 'all'}`;
    const cached = await this.redis.get<PriceTrend>(cacheKey);
    if (cached) {
      return cached;
    }

    const categories = await this.categories.find({
      where: categorySlugs.map((slug) => ({ slug })),
    });

    if (!categories.length) {
      return { categories: [], points: [] };
    }

    const query = this.listings
      .createQueryBuilder('listing')
      .select("TO_CHAR(DATE_TRUNC('month', listing.created_at), 'YYYY-MM')", 'month')
      .addSelect('category.slug', 'slug')
      .addSelect(
        'PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY listing.price)',
        'median',
      )
      .innerJoin('listing.category', 'category')
      .where('category.id IN (:...categoryIds)', {
        categoryIds: categories.map((category) => category.id),
      })
      .andWhere('listing.deleted_at IS NULL')
      .andWhere(
        `listing.created_at >= DATE_TRUNC('month', NOW()) - INTERVAL '${TREND_MONTHS - 1} months'`,
      )
      // Prices are only comparable within one unit; kg is what fruit and
      // vegetables are quoted in, and mixing t and kg would make the line jump
      // by three orders of magnitude.
      .andWhere("listing.price_unit = 'kg'")
      .groupBy('month')
      .addGroupBy('category.slug')
      .orderBy('month', 'ASC');

    if (regionId) {
      query.andWhere('listing.region_id = :regionId', { regionId });
    }

    const rows = await query.getRawMany<{ month: string; slug: string; median: string }>();

    const byMonth = new Map<string, Record<string, number | null>>();
    for (const month of this.recentMonths()) {
      byMonth.set(
        month,
        Object.fromEntries(categories.map((category) => [category.slug, null])),
      );
    }
    for (const row of rows) {
      const bucket = byMonth.get(row.month);
      if (bucket) {
        bucket[row.slug] = Math.round(Number(row.median));
      }
    }

    const result: PriceTrend = {
      categories: categories.map((category) => ({
        slug: category.slug,
        nameUz: category.nameUz,
      })),
      points: [...byMonth.entries()].map(([month, values]) => ({ month, values })),
    };

    await this.redis.set(cacheKey, result, TREND_CACHE_TTL_SECONDS);
    return result;
  }

  /** The last TREND_MONTHS months as "YYYY-MM", oldest first. */
  private recentMonths(): string[] {
    const months: string[] = [];
    const cursor = new Date();
    cursor.setDate(1);
    cursor.setMonth(cursor.getMonth() - (TREND_MONTHS - 1));

    for (let i = 0; i < TREND_MONTHS; i += 1) {
      months.push(
        `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`,
      );
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return months;
  }
}
