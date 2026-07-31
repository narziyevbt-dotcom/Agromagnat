import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { Category } from '../src/modules/catalog/entities/category.entity';
import { District } from '../src/modules/geo/entities/district.entity';
import { Region } from '../src/modules/geo/entities/region.entity';
import { Listing } from '../src/modules/listings/entities/listing.entity';
import { Review } from '../src/modules/reviews/entities/review.entity';
import { User, UserRole } from '../src/modules/users/entities/user.entity';
import { RedisService } from '../src/redis/redis.service';

/** Seller ratings: who may leave one, and what it does to the seller's average. */
describe('Reviews (e2e)', () => {
  let app: INestApplication;
  let users: Repository<User>;
  let listings: Repository<Listing>;
  let reviews: Repository<Review>;
  let redis: RedisService;

  const sellerPhone = `+99898${Math.floor(1_000_000 + Math.random() * 8_999_999)}`;
  const buyerPhone = `+99899${Math.floor(1_000_000 + Math.random() * 8_999_999)}`;
  const adminPhone = `+99833${Math.floor(1_000_000 + Math.random() * 8_999_999)}`;

  let sellerToken: string;
  let buyerToken: string;
  let adminToken: string;
  let sellerId: string;
  let soldListingId: string;
  let activeListingId: string;
  let reviewId: string;

  const login = async (phone: string): Promise<string> => {
    await redis.del(`otp:rate:${phone}`);
    await request(app.getHttpServer()).post('/api/auth/request-otp').send({ phone });
    const response = await request(app.getHttpServer())
      .post('/api/auth/verify-otp')
      .send({ phone, code: '000000', name: 'Test' });
    return response.body.accessToken;
  };

  let newListing: () => Record<string, unknown>;

  const publish = async (): Promise<string> => {
    const response = await request(app.getHttpServer())
      .post('/api/listings')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send(newListing())
      .expect(201);
    return response.body.id;
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
    reviews = moduleRef.get(getRepositoryToken(Review));
    redis = moduleRef.get(RedisService);

    const categoryRepo: Repository<Category> = moduleRef.get(getRepositoryToken(Category));
    const regionRepo: Repository<Region> = moduleRef.get(getRepositoryToken(Region));
    const districtRepo: Repository<District> = moduleRef.get(getRepositoryToken(District));

    const category = (await categoryRepo.find({ order: { sortOrder: 'ASC' }, take: 1 }))[0];
    const region = await regionRepo.findOneOrFail({ where: { slug: 'samarqand' } });
    const district = await districtRepo.findOneOrFail({
      where: { regionId: region.id, slug: 'urgut' },
    });

    newListing = () => ({
      title: `Review test olma ${Math.random().toString(36).slice(2, 8)}`,
      categoryId: category.id,
      quantity: 8,
      quantityUnit: 't',
      price: 9000,
      priceUnit: 'kg',
      regionId: region.id,
      districtId: district.id,
    });

    sellerToken = await login(sellerPhone);
    buyerToken = await login(buyerPhone);
    adminToken = await login(adminPhone);

    sellerId = (await users.findOneOrFail({ where: { phone: sellerPhone } })).id;
    await users.update({ phone: adminPhone }, { role: UserRole.ADMIN });
    // The role lives in the token, so it has to be minted after the promotion.
    adminToken = await login(adminPhone);

    soldListingId = await publish();
    activeListingId = await publish();

    await request(app.getHttpServer())
      .post(`/api/listings/${soldListingId}/sold`)
      .set('Authorization', `Bearer ${sellerToken}`)
      .expect(201);
  });

  afterAll(async () => {
    await reviews.delete({ sellerId });
    await listings.delete([soldListingId, activeListingId]);
    for (const phone of [sellerPhone, buyerPhone, adminPhone]) {
      await users.delete({ phone });
      await redis.del(`otp:rate:${phone}`);
    }
    await redis.delByPattern('feed:v1:*');
    await app.close();
  });

  describe('POST /api/listings/:id/review', () => {
    it('requires authentication', async () => {
      await request(app.getHttpServer())
        .post(`/api/listings/${soldListingId}/review`)
        .send({ rating: 5 })
        .expect(401);
    });

    it('rejects a rating outside 1..5', async () => {
      await request(app.getHttpServer())
        .post(`/api/listings/${soldListingId}/review`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ rating: 6 })
        .expect(400);
    });

    it('refuses a review on a listing that was never sold', async () => {
      await request(app.getHttpServer())
        .post(`/api/listings/${activeListingId}/review`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ rating: 5 })
        .expect(400);
    });

    it('refuses a seller rating themselves', async () => {
      await request(app.getHttpServer())
        .post(`/api/listings/${soldListingId}/review`)
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({ rating: 5 })
        .expect(400);
    });

    it('accepts the buyer\'s rating of a completed deal', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/listings/${soldListingId}/review`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ rating: 4, comment: 'Mahsulot sifatli, yetkazib berish kechikdi' })
        .expect(201);

      expect(response.body).toMatchObject({ rating: 4, sellerId });
      reviewId = response.body.id;
    });

    it('moves the seller\'s denormalised rating', async () => {
      const seller = await users.findOneOrFail({ where: { id: sellerId } });

      expect(Number(seller.ratingAvg)).toBe(4);
      expect(seller.ratingCount).toBe(1);
    });

    it('refuses a second review of the same listing', async () => {
      await request(app.getHttpServer())
        .post(`/api/listings/${soldListingId}/review`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ rating: 1 })
        .expect(409);
    });
  });

  describe('GET /api/listings/:id/review', () => {
    it('hands the buyer back their own review', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/listings/${soldListingId}/review`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(200);

      expect(response.body).toMatchObject({ id: reviewId, rating: 4 });
    });

    it('is empty for a listing the caller has not reviewed', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/listings/${activeListingId}/review`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(200);

      expect(response.body).toEqual({});
    });
  });

  describe('GET /api/sellers/:id/reviews', () => {
    it('is public and carries the star histogram', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/sellers/${sellerId}/reviews`)
        .expect(200);

      expect(response.body).toMatchObject({
        total: 1,
        average: '4.00',
        breakdown: { '1': 0, '2': 0, '3': 0, '4': 1, '5': 0 },
      });
      expect(response.body.items[0].comment).toContain('sifatli');
    });
  });

  describe('POST /api/admin/reviews/:id/hide', () => {
    it('is closed to an ordinary user', async () => {
      await request(app.getHttpServer())
        .post(`/api/admin/reviews/${reviewId}/hide`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ value: true })
        .expect(403);
    });

    it('hides the review and drops it out of the seller average', async () => {
      await request(app.getHttpServer())
        .post(`/api/admin/reviews/${reviewId}/hide`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ value: true })
        .expect(201);

      const seller = await users.findOneOrFail({ where: { id: sellerId } });
      expect(seller.ratingCount).toBe(0);
      expect(Number(seller.ratingAvg)).toBe(0);

      const listed = await request(app.getHttpServer())
        .get(`/api/sellers/${sellerId}/reviews`)
        .expect(200);
      expect(listed.body.total).toBe(0);
    });

    it('restores it again', async () => {
      await request(app.getHttpServer())
        .post(`/api/admin/reviews/${reviewId}/hide`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ value: false })
        .expect(201);

      const seller = await users.findOneOrFail({ where: { id: sellerId } });
      expect(seller.ratingCount).toBe(1);
    });
  });
});
