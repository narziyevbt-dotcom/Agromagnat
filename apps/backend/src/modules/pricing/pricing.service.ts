import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RedisService } from '../../redis/redis.service';
import { QuantityUnit } from '../catalog/units';
import { Listing } from '../listings/entities/listing.entity';
import {
  PriceBasis,
  PriceIndexPointDto,
  PriceSuggestionDto,
  QueryPriceHistoryDto,
  SuggestPriceDto,
} from './dto/pricing.dto';
import { PriceIndex } from './entities/price-index.entity';
import {
  confidenceOf,
  explainUz,
  lotAdjustment,
  MIN_SAMPLE,
  NO_DATA_UZ,
  PriceSample,
} from './price-estimator';

/** How far back a sold listing still says something about today's price. */
const SOLD_WINDOW_DAYS = 60;

/** Active listings are current by definition; this only excludes stale ones. */
const ACTIVE_WINDOW_DAYS = 30;

/** Suggestions are cached briefly — the posting form asks on every unit change. */
const SUGGEST_CACHE_TTL_SECONDS = 600;

/** Bumped when the cached suggestion shape changes. See CatalogService. */
const CACHE_VERSION = 'v1';

interface Population {
  basis: PriceBasis;
  regionScoped: boolean;
  sold: boolean;
}

/**
 * The fallback ladder, strongest first. The estimator walks it and stops at the
 * first population with at least MIN_SAMPLE rows.
 *
 * Widening beats guessing: a national asking-price median labelled as such is
 * useful, and a fabricated local one is not. Widening also never happens
 * silently — the basis rides on the response and is shown to the seller.
 */
const LADDER: Population[] = [
  { basis: PriceBasis.SOLD_LOCAL, regionScoped: true, sold: true },
  { basis: PriceBasis.SOLD_NATIONAL, regionScoped: false, sold: true },
  { basis: PriceBasis.ACTIVE_LOCAL, regionScoped: true, sold: false },
  { basis: PriceBasis.ACTIVE_NATIONAL, regionScoped: false, sold: false },
];

@Injectable()
export class PricingService {
  private readonly logger = new Logger('Pricing');

  constructor(
    @InjectRepository(Listing) private readonly listings: Repository<Listing>,
    @InjectRepository(PriceIndex) private readonly index: Repository<PriceIndex>,
    private readonly redis: RedisService,
  ) {}

  // ----------------------------------------------------------- suggestion

  async suggest(dto: SuggestPriceDto): Promise<PriceSuggestionDto> {
    const cacheKey =
      `price:suggest:${CACHE_VERSION}:${dto.categoryId}:${dto.regionId ?? 'all'}` +
      `:${dto.unit}:${this.lotBucket(dto.quantity)}`;

    const cached = await this.redis.get<PriceSuggestionDto>(cacheKey);
    if (cached) return cached;

    const result = await this.compute(dto);
    await this.redis.set(cacheKey, result, SUGGEST_CACHE_TTL_SECONDS);
    return result;
  }

  private async compute(dto: SuggestPriceDto): Promise<PriceSuggestionDto> {
    for (const population of LADDER) {
      // A region-scoped rung is meaningless when the caller gave no region.
      if (population.regionScoped && !dto.regionId) continue;

      const sample = await this.percentiles(dto, population);
      if (!sample || sample.count < MIN_SAMPLE) continue;

      const confidence = confidenceOf(sample, population.basis);
      const suggested = lotAdjustment(dto.quantity, sample.median);
      const trendPct = await this.trendPct(dto, population.regionScoped);

      return {
        range: {
          min: sample.p25.toFixed(2),
          suggested: suggested.toFixed(2),
          max: sample.p75.toFixed(2),
        },
        unit: dto.unit,
        basis: population.basis,
        sampleSize: sample.count,
        confidence,
        trendPct,
        reasonUz: explainUz({
          basis: population.basis,
          suggested,
          unit: dto.unit,
          sampleSize: sample.count,
          confidence,
          trendPct,
        }),
      };
    }

    // Nothing cleared the floor. Saying so is the correct answer — a made-up
    // number here is worse than no number, because the seller would use it.
    return {
      range: null,
      unit: dto.unit,
      basis: null,
      sampleSize: 0,
      confidence: 0,
      trendPct: null,
      reasonUz: NO_DATA_UZ,
    };
  }

  /**
   * Percentiles over one population.
   *
   * `PERCENTILE_CONT` rather than AVG throughout: a single mistyped listing at
   * 14 000 000 so'm/kg moves a mean into nonsense and leaves a median alone,
   * and mistyped prices are common on a form filled in a field. The quartiles
   * double as the range shown to the seller.
   */
  private async percentiles(
    dto: SuggestPriceDto,
    population: Population,
  ): Promise<PriceSample | null> {
    const query = this.listings
      .createQueryBuilder('listing')
      .select('PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY listing.price)', 'p25')
      .addSelect('PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY listing.price)', 'median')
      .addSelect('PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY listing.price)', 'p75')
      .addSelect('COUNT(*)', 'count')
      .where('listing.category_id = :categoryId', { categoryId: dto.categoryId })
      // Prices are only comparable within one unit — a median mixing t and kg
      // would be three orders of magnitude away from either.
      .andWhere('listing.price_unit = :unit', { unit: dto.unit })
      .andWhere('listing.deleted_at IS NULL')
      // A blocked listing is usually a scam listing, and scam listings are
      // priced to look like bargains. Leaving them in drags the median down.
      .andWhere("listing.status <> 'blocked'");

    if (population.sold) {
      query
        .andWhere("listing.status = 'sold'")
        .andWhere(`listing.sold_at >= NOW() - INTERVAL '${SOLD_WINDOW_DAYS} days'`);
    } else {
      query
        .andWhere("listing.status = 'active'")
        .andWhere(`listing.created_at >= NOW() - INTERVAL '${ACTIVE_WINDOW_DAYS} days'`);
    }

    if (population.regionScoped) {
      query.andWhere('listing.region_id = :regionId', { regionId: dto.regionId });
    }

    const row = await query.getRawOne<{
      p25: string | null;
      median: string | null;
      p75: string | null;
      count: string;
    }>();

    if (!row?.median) return null;

    return {
      p25: Number(row.p25),
      median: Number(row.median),
      p75: Number(row.p75),
      count: Number(row.count),
    };
  }

  /**
   * Percent change against the index snapshot from ~30 days ago.
   *
   * Read from `price_index` rather than recomputed, because the whole point of
   * the nightly snapshot is that today cannot retroactively change what last
   * month's market looked like: listings get sold, deleted and expired, so
   * recomputing a historical median from live rows gives a different answer
   * every day for the same past date.
   */
  private async trendPct(dto: SuggestPriceDto, regionScoped: boolean): Promise<number | null> {
    const rows = await this.index
      .createQueryBuilder('idx')
      .select('idx.price_avg', 'priceAvg')
      .where('idx.category_id = :categoryId', { categoryId: dto.categoryId })
      .andWhere('idx.unit = :unit', { unit: dto.unit })
      .andWhere(
        regionScoped && dto.regionId ? 'idx.region_id = :regionId' : 'idx.region_id IS NULL',
        regionScoped && dto.regionId ? { regionId: dto.regionId } : {},
      )
      .andWhere("idx.day >= CURRENT_DATE - INTERVAL '45 days'")
      .orderBy('idx.day', 'DESC')
      .getRawMany<{ priceAvg: string }>();

    if (rows.length < 2) return null;

    const latest = Number(rows[0].priceAvg);
    const oldest = Number(rows[rows.length - 1].priceAvg);
    if (!Number.isFinite(latest) || !Number.isFinite(oldest) || oldest <= 0) return null;

    return Math.round(((latest - oldest) / oldest) * 1000) / 10;
  }

  private lotBucket(quantity?: number): string {
    if (!quantity) return 'any';
    if (quantity >= 10_000) return 'xl';
    if (quantity >= 1_000) return 'l';
    return 's';
  }

  // -------------------------------------------------------------- history

  /** The index series behind the "bozor narxi" chart. */
  async history(query: QueryPriceHistoryDto): Promise<PriceIndexPointDto[]> {
    const unit = query.unit ?? QuantityUnit.KG;
    const days = query.days ?? 90;

    const rows = await this.index
      .createQueryBuilder('idx')
      .select(['idx.day', 'idx.priceMin', 'idx.priceAvg', 'idx.priceMax', 'idx.sampleSize'])
      .where('idx.category_id = :categoryId', { categoryId: query.categoryId })
      .andWhere('idx.unit = :unit', { unit })
      .andWhere(
        query.regionId ? 'idx.region_id = :regionId' : 'idx.region_id IS NULL',
        query.regionId ? { regionId: query.regionId } : {},
      )
      .andWhere(`idx.day >= CURRENT_DATE - INTERVAL '${days} days'`)
      .orderBy('idx.day', 'ASC')
      .getMany();

    return rows.map((row) => ({
      day: row.day,
      priceMin: row.priceMin,
      priceAvg: row.priceAvg,
      priceMax: row.priceMax,
      sampleSize: row.sampleSize,
    }));
  }

  // ------------------------------------------------------------- snapshot

  /**
   * Writes one day of the index: a row per (category, region, unit) plus a
   * national row per (category, unit).
   *
   * Idempotent by design — the unique index on (day, category, region, unit)
   * plus ON CONFLICT means a retry, a manual re-run or two workers racing all
   * converge on the same rows. A cron that cannot safely be run twice is a cron
   * that will eventually corrupt the series.
   *
   * The whole day is one statement rather than a loop over categories. At the
   * scale this has to reach the round trips would dominate, and doing it in
   * Postgres keeps the percentile computation next to the data.
   */
  async snapshot(day?: string): Promise<number> {
    const target = day ?? 'CURRENT_DATE';
    const dayExpr = day ? '$1::date' : 'CURRENT_DATE';
    const params = day ? [day] : [];

    // GROUPING SETS gives the regional and the national aggregate in one pass;
    // running them as two queries would scan the listings table twice.
    const result = await this.index.query(
      `
      INSERT INTO price_index
        (day, category_id, region_id, unit, price_min, price_avg, price_max, sample_size, trend_pct)
      SELECT
        ${dayExpr} AS day,
        l.category_id,
        r.region_id,
        -- listings.price_unit and price_index.unit are separate Postgres enum
        -- types that happen to share every value, and Postgres will not coerce
        -- between two enums. Round-tripping through text is the cast that
        -- works; without it the whole snapshot fails at runtime while
        -- typechecking cleanly.
        l.price_unit::text::price_index_unit_enum AS unit,
        ROUND(PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY l.price)::numeric, 2),
        ROUND(PERCENTILE_CONT(0.5)  WITHIN GROUP (ORDER BY l.price)::numeric, 2),
        ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY l.price)::numeric, 2),
        COUNT(*),
        0
      FROM listings l
      CROSS JOIN LATERAL (VALUES (l.region_id), (NULL::uuid)) AS r(region_id)
      WHERE l.deleted_at IS NULL
        AND l.status IN ('active', 'sold')
        AND l.created_at >= ${dayExpr} - INTERVAL '${ACTIVE_WINDOW_DAYS} days'
      GROUP BY l.category_id, r.region_id, l.price_unit
      HAVING COUNT(*) >= $${params.length + 1}
      ON CONFLICT (day, category_id, region_id, unit) DO UPDATE SET
        price_min   = EXCLUDED.price_min,
        price_avg   = EXCLUDED.price_avg,
        price_max   = EXCLUDED.price_max,
        sample_size = EXCLUDED.sample_size,
        updated_at  = NOW()
      RETURNING 1
      `,
      [...params, MIN_SAMPLE],
    );

    // RETURNING so the row count is the driver's, not a guess. Without it an
    // INSERT comes back as an empty array and the job would log "0 rows" on
    // every successful night.
    const written = Array.isArray(result) ? result.length : 0;

    // Trend is a second pass because it compares each fresh row against the
    // previous recorded day for the same key — which the INSERT cannot see.
    await this.index.query(
      `
      UPDATE price_index cur
         SET trend_pct = COALESCE((
               -- A correlated scalar subquery, not UPDATE ... FROM LATERAL:
               -- the update target is not visible to a LATERAL in its own FROM
               -- clause, which Postgres rejects with "invalid reference to
               -- FROM-clause entry".
               SELECT ROUND(
                        ((cur.price_avg - p.price_avg) / p.price_avg * 100)::numeric, 2)
                 FROM price_index p
                WHERE p.category_id = cur.category_id
                  AND p.unit = cur.unit
                  -- IS NOT DISTINCT FROM, because the national row's region is
                  -- NULL and an equality test would never match it.
                  AND p.region_id IS NOT DISTINCT FROM cur.region_id
                  AND p.day < cur.day
                  AND p.price_avg > 0
                ORDER BY p.day DESC
                LIMIT 1
             ), 0)
       WHERE cur.day = ${dayExpr}
`,
      params,
    );

    // A new day of data invalidates every cached suggestion.
    await this.redis.delByPattern(`price:suggest:${CACHE_VERSION}:*`);

    this.logger.log(`Price index snapshot for ${day ?? 'today'}: ${written} row(s)`);
    return written;
  }
}
