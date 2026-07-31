import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { In, Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { CategoryKind } from '../src/modules/catalog/category-forms';
import { Category } from '../src/modules/catalog/entities/category.entity';
import { QuantityUnit } from '../src/modules/catalog/units';
import { District } from '../src/modules/geo/entities/district.entity';
import { Region } from '../src/modules/geo/entities/region.entity';
import { Listing, ListingStatus } from '../src/modules/listings/entities/listing.entity';
import { PriceBasis } from '../src/modules/pricing/dto/pricing.dto';
import { PriceIndex } from '../src/modules/pricing/entities/price-index.entity';
import { PricingService } from '../src/modules/pricing/pricing.service';
import { User } from '../src/modules/users/entities/user.entity';
import { RedisService } from '../src/redis/redis.service';

/**
 * The price recommender against real Postgres.
 *
 * Every assertion here is on SQL a unit test cannot reach: percentiles,
 * partial-index predicates, the GROUPING-SETS snapshot and its ON CONFLICT
 * upsert. Mocking a query builder proves the code compiles, not that the query
 * runs — which is how a 500 shipped from this repo once already.
 */
describe('Pricing (e2e)', () => {
  let app: INestApplication;
  let pricing: PricingService;
  let listings: Repository<Listing>;
  let index: Repository<PriceIndex>;
  let users: Repository<User>;
  let redis: RedisService;
  let categoryRepo: Repository<Category>;
  let regionRepo: Repository<Region>;
  let districtRepo: Repository<District>;

  const phone = `+99895${Math.floor(1_000_000 + Math.random() * 8_999_999)}`;
  let sellerId: string;
  let categoryId: string;
  let otherCategoryId: string;
  let agreedCategoryId: string;
  let regionId: string;
  let otherRegionId: string;
  let districtId: string;
  const created: string[] = [];

  /** Seeds one listing directly — the recommender reads rows, not endpoints. */
  const seed = async (opts: {
    price: number;
    status: ListingStatus;
    regionId?: string;
    categoryId?: string;
    soldDaysAgo?: number;
    createdDaysAgo?: number;
    priceUnit?: string;
    soldPrice?: number;
  }) => {
    const listing = await listings.save(
      listings.create({
        title: `Narx testi ${Math.random().toString(36).slice(2, 9)}`,
        sellerId,
        categoryId: opts.categoryId ?? categoryId,
        quantity: '10.000',
        quantityUnit: 't' as never,
        price: opts.price.toFixed(2),
        priceUnit: (opts.priceUnit ?? 'kg') as never,
        regionId: opts.regionId ?? regionId,
        districtId,
        status: opts.status,
        soldPrice: opts.soldPrice === undefined ? null : opts.soldPrice.toFixed(2),
        attributes: {},
      }),
    );
    created.push(listing.id);

    // Ages are set with SQL because created_at is insert-managed by TypeORM.
    const soldAt =
      opts.status === ListingStatus.SOLD
        ? `NOW() - INTERVAL '${opts.soldDaysAgo ?? 5} days'`
        : 'NULL';
    await listings.query(
      `UPDATE listings
          SET created_at = NOW() - INTERVAL '${opts.createdDaysAgo ?? 3} days',
              sold_at = ${soldAt}
        WHERE id = $1`,
      [listing.id],
    );
    return listing.id;
  };

  const suggest = (body: Record<string, unknown>) =>
    request(app.getHttpServer()).post('/api/pricing/suggest').send(body);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api', { exclude: ['health'] });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();

    pricing = moduleRef.get(PricingService);
    listings = moduleRef.get(getRepositoryToken(Listing));
    index = moduleRef.get(getRepositoryToken(PriceIndex));
    users = moduleRef.get(getRepositoryToken(User));
    redis = moduleRef.get(RedisService);

    const categories: Repository<Category> = moduleRef.get(getRepositoryToken(Category));
    const regions: Repository<Region> = moduleRef.get(getRepositoryToken(Region));
    const districts: Repository<District> = moduleRef.get(getRepositoryToken(District));

    // Throwaway reference rows rather than the seeded ones.
    //
    // Every assertion here is about the shape of a population, so the test has
    // to own that population completely. Reusing 'sabzavotlar' in Samarqand
    // passed on a bare database and broke the moment `npm run seed:demo` had
    // been run — sixty demo sales landed in the same bucket and the medians,
    // the sample floor and the sold/active ladder all moved. A test that only
    // holds on an empty database is not a test of this feature.
    const stamp = Math.random().toString(36).slice(2, 9);
    categoryRepo = categories;
    regionRepo = regions;
    districtRepo = districts;

    categoryId = (
      await categories.save(
        categories.create({
          nameUz: `Narx testi ${stamp}`,
          nameRu: `Narx testi ${stamp}`,
          slug: `narx-testi-${stamp}`,
          kind: CategoryKind.PRODUCE,
          unitDefault: QuantityUnit.KG,
          sortOrder: 900,
        }),
      )
    ).id;
    otherCategoryId = (
      await categories.save(
        categories.create({
          nameUz: `Narx testi 2 ${stamp}`,
          nameRu: `Narx testi 2 ${stamp}`,
          slug: `narx-testi-2-${stamp}`,
          kind: CategoryKind.PRODUCE,
          unitDefault: QuantityUnit.KG,
          sortOrder: 901,
        }),
      )
    ).id;

    agreedCategoryId = (
      await categories.save(
        categories.create({
          nameUz: `Kelishuv narxi ${stamp}`,
          nameRu: `Kelishuv narxi ${stamp}`,
          slug: `kelishuv-narxi-${stamp}`,
          kind: CategoryKind.PRODUCE,
          unitDefault: QuantityUnit.KG,
          sortOrder: 902,
        }),
      )
    ).id;

    const region = await regions.save(
      regions.create({
        nameUz: `Narx viloyati ${stamp}`,
        nameRu: `Narx viloyati ${stamp}`,
        slug: `narx-viloyati-${stamp}`,
        sortOrder: 900,
      }),
    );
    regionId = region.id;
    otherRegionId = (
      await regions.save(
        regions.create({
          nameUz: `Bo'sh viloyat ${stamp}`,
          nameRu: `Bo'sh viloyat ${stamp}`,
          slug: `bosh-viloyat-${stamp}`,
          sortOrder: 901,
        }),
      )
    ).id;
    districtId = (
      await districts.save(
        districts.create({
          nameUz: `Narx tumani ${stamp}`,
          nameRu: `Narx tumani ${stamp}`,
          slug: `narx-tumani-${stamp}`,
          regionId,
        }),
      )
    ).id;

    sellerId = (await users.save(users.create({ phone, name: 'Narx testi' }))).id;
  });

  beforeEach(async () => {
    // Suggestions are cached for ten minutes; each case seeds its own market.
    await redis.delByPattern('price:suggest:*');
  });

  afterAll(async () => {
    if (created.length) await listings.delete(created);
    await index.delete({ categoryId: In([categoryId, otherCategoryId, agreedCategoryId]) });
    await users.delete({ phone });
    // Reference rows last — listings hold RESTRICT foreign keys to them.
    await districtRepo.delete(districtId);
    await regionRepo.delete([regionId, otherRegionId]);
    await categoryRepo.delete([categoryId, otherCategoryId, agreedCategoryId]);
    await redis.delByPattern('price:suggest:*');
    await app.close();
  });

  describe('POST /api/pricing/suggest', () => {
    it('is public — a buyer checking a price should not need an account', async () => {
      await suggest({ categoryId, regionId, unit: 'kg' }).expect(201);
    });

    it('validates the body', async () => {
      await suggest({ categoryId: 'not-a-uuid', unit: 'kg' }).expect(400);
      await suggest({ categoryId, unit: 'parrak' }).expect(400);
    });

    it('says it does not know rather than inventing a number', async () => {
      // Nothing seeded for this category yet. A fabricated price here would be
      // acted on by a farmer, which is why the honest answer is null.
      const { body } = await suggest({
        categoryId: otherCategoryId,
        regionId: otherRegionId,
        unit: 'ga',
      }).expect(201);

      expect(body.range).toBeNull();
      expect(body.basis).toBeNull();
      expect(body.confidence).toBe(0);
      expect(body.reasonUz).toContain("ma’lumot yo‘q");
    });

    it('ignores a population below the minimum sample', async () => {
      const ids = [
        await seed({ price: 14_000, status: ListingStatus.SOLD }),
        await seed({ price: 14_000, status: ListingStatus.SOLD }),
      ];

      const { body } = await suggest({ categoryId, regionId, unit: 'kg' }).expect(201);
      expect(body.range).toBeNull();

      // Removed again so the next case's population is exactly what it seeds.
      // Leaving two rows behind would shift its median and make the failure
      // look like a percentile bug rather than test bleed.
      await listings.delete(ids);
    });

    it('prefers local sold prices and returns real percentiles', async () => {
      for (const price of [10_000, 11_000, 12_000, 13_000, 14_000, 15_000, 16_000]) {
        await seed({ price, status: ListingStatus.SOLD });
      }

      const { body } = await suggest({ categoryId, regionId, unit: 'kg' }).expect(201);

      expect(body.basis).toBe(PriceBasis.SOLD_LOCAL);
      expect(Number(body.range.suggested)).toBeCloseTo(13_000, 0);
      expect(Number(body.range.min)).toBeLessThan(Number(body.range.suggested));
      expect(Number(body.range.max)).toBeGreaterThan(Number(body.range.suggested));
      expect(body.sampleSize).toBeGreaterThanOrEqual(7);
      expect(body.confidence).toBeGreaterThan(0);
      expect(body.reasonUz).toContain('so‘m/kg');
    });

    it('is not moved into nonsense by one mistyped price', async () => {
      // A price typed with three extra zeros is common on a form filled in a
      // field. A mean would follow it; a median must not.
      const before = await suggest({ categoryId, regionId, unit: 'kg' }).expect(201);
      await seed({ price: 14_000_000, status: ListingStatus.SOLD });
      await redis.delByPattern('price:suggest:*');
      const after = await suggest({ categoryId, regionId, unit: 'kg' }).expect(201);

      const drift = Math.abs(
        Number(after.body.range.suggested) - Number(before.body.range.suggested),
      );
      expect(drift).toBeLessThan(2_000);
    });

    it('never mixes units — a price per tonne is not a price per kilo', async () => {
      for (const price of [9_000_000, 9_500_000, 10_000_000, 10_500_000, 11_000_000]) {
        await seed({ price, status: ListingStatus.SOLD, priceUnit: 't' });
      }

      const perKg = await suggest({ categoryId, regionId, unit: 'kg' }).expect(201);
      const perTonne = await suggest({ categoryId, regionId, unit: 't' }).expect(201);

      expect(Number(perKg.body.range.suggested)).toBeLessThan(100_000);
      expect(Number(perTonne.body.range.suggested)).toBeGreaterThan(1_000_000);
    });

    it('widens to the nation when the region has no data, and says so', async () => {
      const { body } = await suggest({
        categoryId,
        regionId: otherRegionId,
        unit: 'kg',
      }).expect(201);

      expect(body.basis).toBe(PriceBasis.SOLD_NATIONAL);
      expect(body.reasonUz).toContain('respublika');
    });

    it('falls back to asking prices when nothing has sold', async () => {
      for (const price of [21_000, 22_000, 23_000, 24_000, 25_000, 26_000]) {
        await seed({ price, status: ListingStatus.ACTIVE, categoryId: otherCategoryId });
      }

      const { body } = await suggest({
        categoryId: otherCategoryId,
        regionId,
        unit: 'kg',
      }).expect(201);

      expect(body.basis).toBe(PriceBasis.ACTIVE_LOCAL);
      expect(body.reasonUz).toContain('e’lon');
    });

    it('excludes blocked listings, which are priced to look like bargains', async () => {
      const clean = await suggest({
        categoryId: otherCategoryId,
        regionId,
        unit: 'kg',
      }).expect(201);

      for (let i = 0; i < 6; i += 1) {
        await seed({ price: 1_000, status: ListingStatus.BLOCKED, categoryId: otherCategoryId });
      }
      await redis.delByPattern('price:suggest:*');

      const after = await suggest({
        categoryId: otherCategoryId,
        regionId,
        unit: 'kg',
      }).expect(201);

      expect(after.body.range.suggested).toBe(clean.body.range.suggested);
    });

    it('ignores a sale too old to say anything about today', async () => {
      const fresh = await suggest({ categoryId, regionId, unit: 'kg' }).expect(201);

      for (let i = 0; i < 8; i += 1) {
        await seed({ price: 500, status: ListingStatus.SOLD, soldDaysAgo: 400 });
      }
      await redis.delByPattern('price:suggest:*');

      const after = await suggest({ categoryId, regionId, unit: 'kg' }).expect(201);
      expect(after.body.range.suggested).toBe(fresh.body.range.suggested);
    });

    it('reads the agreed price on sold rows, not the asking price', async () => {
      // The whole argument for "based on real sales": a sold listing keeps its
      // asking price in `price` and what it actually cleared at in
      // `sold_price`. Agricultural sales close below asking almost every time,
      // so reading `price` here made the recommendation systematically high.
      for (const price of [30_000, 31_000, 32_000, 33_000, 34_000, 35_000]) {
        await seed({
          price,
          status: ListingStatus.SOLD,
          categoryId: agreedCategoryId,
          soldPrice: price - 20_000,
        });
      }

      const { body } = await suggest({
        categoryId: agreedCategoryId,
        regionId,
        unit: 'kg',
      }).expect(201);

      expect(body.basis).toBe(PriceBasis.SOLD_LOCAL);
      // Median of the agreed prices (12 500), not of the asking ones (32 500).
      expect(Number(body.range.suggested)).toBeLessThan(20_000);
    });

    it('keeps hand-closed sales in the population via COALESCE', async () => {
      // A seller who pressed "Sotildi" without a deal has no agreed price.
      // Dropping those rows would shrink the sold population below its floor
      // for every category that predates offers.
      const { body } = await suggest({ categoryId, regionId, unit: 'kg' }).expect(201);
      expect(body.basis).toBe(PriceBasis.SOLD_LOCAL);
      expect(body.sampleSize).toBeGreaterThanOrEqual(5);
    });

    it('prices a wholesale lot below a retail one', async () => {
      const retail = await suggest({ categoryId, regionId, unit: 'kg', quantity: 50 });
      const bulk = await suggest({ categoryId, regionId, unit: 'kg', quantity: 50_000 });

      expect(Number(bulk.body.range.suggested)).toBeLessThan(
        Number(retail.body.range.suggested),
      );
    });
  });

  describe('snapshot', () => {
    it('writes a regional and a national row per category and unit', async () => {
      await index.delete({ categoryId });
      const written = await pricing.snapshot();
      expect(written).toBeGreaterThan(0);

      const regional = await index.findOne({
        where: { categoryId, regionId, unit: 'kg' as never },
      });
      const national = await index.findOne({
        where: { categoryId, regionId: null as never, unit: 'kg' as never },
      });

      expect(regional).not.toBeNull();
      expect(national).not.toBeNull();
      expect(Number(regional!.priceAvg)).toBeGreaterThan(0);
      expect(Number(regional!.priceMin)).toBeLessThanOrEqual(Number(regional!.priceAvg));
      expect(Number(regional!.priceMax)).toBeGreaterThanOrEqual(Number(regional!.priceAvg));
      expect(regional!.sampleSize).toBeGreaterThan(0);
    });

    it('is idempotent — a re-run updates in place instead of duplicating the day', async () => {
      // This is what makes a missed night safe to backfill and two instances
      // safe to run the same cron.
      await pricing.snapshot();
      const first = await index.count({ where: { categoryId } });
      await pricing.snapshot();
      const second = await index.count({ where: { categoryId } });

      expect(second).toBe(first);
    });

    it('computes a trend against the previous recorded day', async () => {
      await index.delete({ categoryId });
      await pricing.snapshot('2026-01-01');
      await index.update(
        { categoryId, unit: 'kg' as never },
        { priceAvg: '10000.00' },
      );
      await pricing.snapshot('2026-01-02');

      const later = await index.findOneOrFail({
        where: { categoryId, regionId, unit: 'kg' as never, day: '2026-01-02' },
      });
      expect(Number(later.trendPct)).not.toBe(0);
    });
  });

  describe('GET /api/pricing/history', () => {
    it('returns the series for the chart', async () => {
      await pricing.snapshot();

      const { body } = await request(app.getHttpServer())
        .get('/api/pricing/history')
        .query({ categoryId, regionId, unit: 'kg', days: 90 })
        .expect(200);

      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBeGreaterThan(0);
      expect(body[0]).toHaveProperty('priceAvg');
      expect(body[0]).toHaveProperty('sampleSize');
    });

    it('rejects an out-of-range window instead of scanning the whole table', async () => {
      await request(app.getHttpServer())
        .get('/api/pricing/history')
        .query({ categoryId, days: 5000 })
        .expect(400);
    });
  });
});
