import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { Category } from '../src/modules/catalog/entities/category.entity';
import { District } from '../src/modules/geo/entities/district.entity';
import { Region } from '../src/modules/geo/entities/region.entity';
import { Listing, ListingStatus } from '../src/modules/listings/entities/listing.entity';
import { User } from '../src/modules/users/entities/user.entity';
import { RedisService } from '../src/redis/redis.service';

/** Listings CRUD, filters and favorites against real Postgres and Redis. */
describe('Listings (e2e)', () => {
  let app: INestApplication;
  let users: Repository<User>;
  let listings: Repository<Listing>;
  let redis: RedisService;

  const sellerPhone = `+99891${Math.floor(1_000_000 + Math.random() * 8_999_999)}`;
  const buyerPhone = `+99893${Math.floor(1_000_000 + Math.random() * 8_999_999)}`;

  let sellerToken: string;
  let buyerToken: string;
  let categoryId: string;
  let otherCategoryId: string;
  let regionId: string;
  let districtId: string;
  const created: string[] = [];

  const login = async (phone: string): Promise<string> => {
    await redis.del(`otp:rate:${phone}`);
    await request(app.getHttpServer()).post('/api/auth/request-otp').send({ phone });
    const response = await request(app.getHttpServer())
      .post('/api/auth/verify-otp')
      .send({ phone, code: '000000', name: 'Test' });
    return response.body.accessToken;
  };

  const validListing = () => ({
    title: `Test pomidor ${Math.random().toString(36).slice(2, 8)}`,
    description: 'Sifatli, yangi uzilgan',
    categoryId,
    quantity: 12,
    quantityUnit: 't',
    price: 14000,
    priceUnit: 'kg',
    regionId,
    districtId,
  });

  const post = async (body: Record<string, unknown>, expected = 201) => {
    const response = await request(app.getHttpServer())
      .post('/api/listings')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send(body)
      .expect(expected);
    if (response.body?.id) {
      created.push(response.body.id);
    }
    return response;
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api', { exclude: ['health'] });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();

    users = moduleRef.get(getRepositoryToken(User));
    listings = moduleRef.get(getRepositoryToken(Listing));
    redis = moduleRef.get(RedisService);

    const categoryRepo: Repository<Category> = moduleRef.get(getRepositoryToken(Category));
    const regionRepo: Repository<Region> = moduleRef.get(getRepositoryToken(Region));
    const districtRepo: Repository<District> = moduleRef.get(getRepositoryToken(District));

    const [first, second] = await categoryRepo.find({ order: { sortOrder: 'ASC' }, take: 2 });
    categoryId = first.id;
    otherCategoryId = second.id;

    const region = await regionRepo.findOneOrFail({ where: { slug: 'samarqand' } });
    regionId = region.id;
    districtId = (await districtRepo.findOneOrFail({ where: { regionId, slug: 'urgut' } })).id;

    sellerToken = await login(sellerPhone);
    buyerToken = await login(buyerPhone);
  });

  afterAll(async () => {
    if (created.length) {
      await listings.delete(created);
    }
    await users.delete({ phone: sellerPhone });
    await users.delete({ phone: buyerPhone });
    await redis.delByPattern('feed:v1:*');
    await app.close();
  });

  describe('POST /api/listings', () => {
    it('requires authentication', async () => {
      await request(app.getHttpServer()).post('/api/listings').send(validListing()).expect(401);
    });

    it('publishes an active listing expiring in 14 days', async () => {
      const response = await post(validListing());

      expect(response.body).toMatchObject({
        status: ListingStatus.ACTIVE,
        quantity: '12.000',
        price: '14000.00',
      });

      const days =
        (new Date(response.body.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      expect(days).toBeGreaterThan(13.9);
      expect(days).toBeLessThan(14.1);
    });

    it('rejects a listing with no volume — the field that defines the product', async () => {
      const { quantity, ...withoutQuantity } = validListing();
      await post(withoutQuantity as never, 400);
    });

    it('rejects a negative price', async () => {
      await post({ ...validListing(), price: -5 }, 400);
    });

    it('rejects an unknown field rather than silently dropping it', async () => {
      await post({ ...validListing(), isPromoted: true }, 400);
    });

    it('rejects a wholesale price that is not below the retail price', async () => {
      await post({ ...validListing(), minOrder: 2, wholesalePrice: 20000 }, 400);
    });

    it('rejects a wholesale price with no minimum lot', async () => {
      await post({ ...validListing(), wholesalePrice: 12000 }, 400);
    });

    it('accepts a coherent wholesale pair', async () => {
      const response = await post({ ...validListing(), minOrder: 2, wholesalePrice: 12000 });
      expect(response.body).toMatchObject({ minOrder: '2.000', wholesalePrice: '12000.00' });
    });
  });

  describe('GET /api/listings', () => {
    it('is public and returns a cursor-paginated page', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/listings')
        .query({ limit: 5 })
        .expect(200);

      expect(response.body).toMatchObject({
        items: expect.any(Array),
        hasMore: expect.any(Boolean),
      });
      expect(response.body.items.length).toBeLessThanOrEqual(5);
    });

    it('filters by category', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/listings')
        .query({ categoryId: otherCategoryId })
        .expect(200);

      for (const item of response.body.items) {
        expect(item.categoryId).toBe(otherCategoryId);
      }
    });

    it('filters by minimum volume — the wholesale filter', async () => {
      await post({ ...validListing(), quantity: 0.5 });

      const response = await request(app.getHttpServer())
        .get('/api/listings')
        .query({ regionId, quantityMin: 1 })
        .expect(200);

      for (const item of response.body.items) {
        expect(Number(item.quantity)).toBeGreaterThanOrEqual(1);
      }
    });

    it('filters by price range', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/listings')
        .query({ priceMin: 10000, priceMax: 20000 })
        .expect(200);

      for (const item of response.body.items) {
        expect(Number(item.price)).toBeGreaterThanOrEqual(10000);
        expect(Number(item.price)).toBeLessThanOrEqual(20000);
      }
    });

    it('finds a listing by a word from its title', async () => {
      const created = await post({ ...validListing(), title: 'Qorabuloq uzumi shirin' });

      const response = await request(app.getHttpServer())
        .get('/api/listings')
        .query({ q: 'Qorabuloq' })
        .expect(200);

      expect(response.body.items.map((i: { id: string }) => i.id)).toContain(created.body.id);
    });

    it('matches a bare root against a suffixed word — Uzbek has no stemmer', async () => {
      // The listing says "pomidori", the buyer types "pomidor". This is the
      // single most common search in the product, and exact matching misses it.
      const created = await post({ ...validListing(), title: 'Andijon pomidori yangi' });

      const response = await request(app.getHttpServer())
        .get('/api/listings')
        .query({ q: 'pomidor' })
        .expect(200);

      expect(response.body.items.map((i: { id: string }) => i.id)).toContain(created.body.id);
    });

    it('is case-insensitive', async () => {
      const created = await post({ ...validListing(), title: 'Nurota Qovuni shirin' });

      const response = await request(app.getHttpServer())
        .get('/api/listings')
        .query({ q: 'nurota' })
        .expect(200);

      expect(response.body.items.map((i: { id: string }) => i.id)).toContain(created.body.id);
    });

    it('survives a query of pure punctuation instead of matching everything', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/listings')
        .query({ q: '!!! ???' })
        .expect(200);

      expect(response.body.items).toHaveLength(0);
    });

    it('does not let a typed operator reach the tsquery parser', async () => {
      // "&" and ":*" are to_tsquery syntax; sanitising must strip them rather
      // than let Postgres raise a syntax error the user would see as a 500.
      await request(app.getHttpServer())
        .get('/api/listings')
        .query({ q: 'pomidor & | ! :* ()' })
        .expect(200);
    });

    it('sorts cheapest first within a promotion tier, and puts TOP listings above it', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/listings')
        .query({ sort: 'cheapest', limit: 20 })
        .expect(200);

      const items: Array<{ price: string; isPromoted: boolean }> = response.body.items;

      // Paid TOP placement outranks price — that is what the placement is sold
      // for, and the feed's ORDER BY leads with the promotion rank for every
      // sort. Asserting a single globally ascending run passed only while no
      // listing in the database happened to be promoted, so it was checking
      // the fixture rather than the ranking.
      const promoted = items.filter((item) => item.isPromoted);
      const rest = items.filter((item) => !item.isPromoted);
      expect(items.slice(0, promoted.length)).toEqual(promoted);

      for (const tier of [promoted, rest]) {
        const prices = tier.map((item) => Number(item.price));
        expect([...prices].sort((a, b) => a - b)).toEqual(prices);
      }
    });

    it('walks pages without repeating or skipping an item', async () => {
      const first = await request(app.getHttpServer())
        .get('/api/listings')
        .query({ limit: 2 })
        .expect(200);

      if (!first.body.hasMore) {
        return;
      }

      const second = await request(app.getHttpServer())
        .get('/api/listings')
        .query({ limit: 2, cursor: first.body.nextCursor })
        .expect(200);

      const firstIds = first.body.items.map((i: { id: string }) => i.id);
      const secondIds = second.body.items.map((i: { id: string }) => i.id);
      expect(firstIds.filter((id: string) => secondIds.includes(id))).toHaveLength(0);
    });

    it('restarts the feed on a malformed cursor instead of failing', async () => {
      await request(app.getHttpServer())
        .get('/api/listings')
        .query({ cursor: 'not-a-cursor' })
        .expect(200);
    });

    it('rejects a limit above the ceiling', async () => {
      await request(app.getHttpServer()).get('/api/listings').query({ limit: 500 }).expect(400);
    });
  });

  describe('GET /api/listings/:id', () => {
    it('increments view_count for a visitor', async () => {
      const listing = await post(validListing());

      const first = await request(app.getHttpServer())
        .get(`/api/listings/${listing.body.id}`)
        .expect(200);
      expect(first.body.viewCount).toBe(1);

      const second = await request(app.getHttpServer())
        .get(`/api/listings/${listing.body.id}`)
        .expect(200);
      expect(second.body.viewCount).toBe(2);
    });

    it('does not count the owner viewing their own listing', async () => {
      const listing = await post(validListing());

      const response = await request(app.getHttpServer())
        .get(`/api/listings/${listing.body.id}`)
        .set('Authorization', `Bearer ${sellerToken}`)
        .expect(200);

      expect(response.body.viewCount).toBe(0);
    });

    it('404s for an unknown id', async () => {
      await request(app.getHttpServer())
        .get('/api/listings/00000000-0000-4000-8000-000000000000')
        .expect(404);
    });
  });

  describe('ownership', () => {
    it('refuses an edit by someone else', async () => {
      const listing = await post(validListing());

      await request(app.getHttpServer())
        .patch(`/api/listings/${listing.body.id}`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ price: 1 })
        .expect(403);
    });

    it('refuses a delete by someone else', async () => {
      const listing = await post(validListing());

      await request(app.getHttpServer())
        .delete(`/api/listings/${listing.body.id}`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(403);
    });

    it('lets the owner edit and mark sold', async () => {
      const listing = await post(validListing());

      const updated = await request(app.getHttpServer())
        .patch(`/api/listings/${listing.body.id}`)
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({ price: 15500 })
        .expect(200);
      expect(updated.body.price).toBe('15500.00');

      const sold = await request(app.getHttpServer())
        .post(`/api/listings/${listing.body.id}/sold`)
        .set('Authorization', `Bearer ${sellerToken}`)
        .expect(201);
      expect(sold.body.status).toBe(ListingStatus.SOLD);
    });
  });

  describe('call counter — the north-star metric', () => {
    it('increments and is callable without logging in', async () => {
      const listing = await post(validListing());

      const first = await request(app.getHttpServer())
        .post(`/api/listings/${listing.body.id}/call`)
        .expect(200);
      expect(first.body.callCount).toBe(1);

      const second = await request(app.getHttpServer())
        .post(`/api/listings/${listing.body.id}/call`)
        .expect(200);
      expect(second.body.callCount).toBe(2);
    });
  });

  describe('favorites', () => {
    it('saves, lists, marks and removes', async () => {
      const listing = await post(validListing());
      const id = listing.body.id;

      await request(app.getHttpServer())
        .post(`/api/listings/${id}/favorite`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(204);

      const saved = await request(app.getHttpServer())
        .get('/api/me/favorites')
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(200);
      expect(saved.body.map((i: { id: string }) => i.id)).toContain(id);

      // The feed tells the buyer which items they already saved.
      const feed = await request(app.getHttpServer())
        .get('/api/listings')
        .query({ limit: 50 })
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(200);
      const inFeed = feed.body.items.find((i: { id: string }) => i.id === id);
      if (inFeed) {
        expect(inFeed.isFavorite).toBe(true);
      }

      await request(app.getHttpServer())
        .delete(`/api/listings/${id}/favorite`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(204);

      const after = await request(app.getHttpServer())
        .get('/api/me/favorites')
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(200);
      expect(after.body.map((i: { id: string }) => i.id)).not.toContain(id);
    });

    it('is idempotent — saving twice does not double the counter', async () => {
      const listing = await post(validListing());
      const id = listing.body.id;

      await request(app.getHttpServer())
        .post(`/api/listings/${id}/favorite`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(204);
      await request(app.getHttpServer())
        .post(`/api/listings/${id}/favorite`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(204);

      const detail = await request(app.getHttpServer()).get(`/api/listings/${id}`).expect(200);
      expect(detail.body.favoriteCount).toBe(1);
    });
  });

  describe('expiry', () => {
    it('archives a listing past expires_at and drops it from the feed', async () => {
      const listing = await post(validListing());
      const id = listing.body.id;

      await listings.update(id, { expiresAt: new Date(Date.now() - 1000) });

      const { ListingsService } = await import('../src/modules/listings/listings.service');
      const service = app.get(ListingsService);
      await service.expireStale();

      const detail = await request(app.getHttpServer()).get(`/api/listings/${id}`).expect(200);
      expect(detail.body.status).toBe(ListingStatus.EXPIRED);

      const feed = await request(app.getHttpServer())
        .get('/api/listings')
        .query({ limit: 50, regionId })
        .expect(200);
      expect(feed.body.items.map((i: { id: string }) => i.id)).not.toContain(id);
    });
  });
});
