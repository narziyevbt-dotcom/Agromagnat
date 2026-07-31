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
import { Report } from '../src/modules/reports/entities/report.entity';
import { User, UserRole } from '../src/modules/users/entities/user.entity';
import { RedisService } from '../src/redis/redis.service';

/** Admin surface: role guard, moderation, users, reports — real stack. */
describe('Admin (e2e)', () => {
  let app: INestApplication;
  let users: Repository<User>;
  let listings: Repository<Listing>;
  let reports: Repository<Report>;
  let redis: RedisService;

  const adminPhone = `+99894${Math.floor(1_000_000 + Math.random() * 8_999_999)}`;
  const sellerPhone = `+99895${Math.floor(1_000_000 + Math.random() * 8_999_999)}`;

  let adminToken: string;
  let sellerToken: string;
  let sellerId: string;
  let categoryId: string;
  let regionId: string;
  let districtId: string;

  const login = async (phone: string): Promise<string> => {
    await redis.del(`otp:rate:${phone}`);
    await request(app.getHttpServer()).post('/api/auth/request-otp').send({ phone });
    const response = await request(app.getHttpServer())
      .post('/api/auth/verify-otp')
      .send({ phone, code: '000000', name: 'Test' });
    return response.body.accessToken;
  };

  const createListing = async (overrides: Record<string, unknown> = {}) => {
    const response = await request(app.getHttpServer())
      .post('/api/listings')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({
        title: `Admin test mahsulot ${Math.random().toString(36).slice(2, 8)}`,
        categoryId,
        quantity: 3,
        quantityUnit: 't',
        price: 9000,
        priceUnit: 'kg',
        regionId,
        districtId,
        ...overrides,
      })
      .expect(201);
    return response.body as Listing;
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
    reports = moduleRef.get(getRepositoryToken(Report));
    redis = moduleRef.get(RedisService);

    const categoryRepo: Repository<Category> = moduleRef.get(getRepositoryToken(Category));
    const regionRepo: Repository<Region> = moduleRef.get(getRepositoryToken(Region));
    const districtRepo: Repository<District> = moduleRef.get(getRepositoryToken(District));

    categoryId = (await categoryRepo.find({ take: 1 }))[0].id;
    const region = await regionRepo.findOneOrFail({ where: { slug: 'samarqand' } });
    regionId = region.id;
    districtId = (
      await districtRepo.findOneOrFail({ where: { regionId, slug: 'urgut' } })
    ).id;

    sellerToken = await login(sellerPhone);
    sellerId = (await users.findOneOrFail({ where: { phone: sellerPhone } })).id;

    // Promote through the same path production uses (a direct role update),
    // then log in again so the token carries the admin role.
    adminToken = await login(adminPhone);
    await users.update({ phone: adminPhone }, { role: UserRole.ADMIN });
    adminToken = await login(adminPhone);
  });

  afterAll(async () => {
    const cleanupIds = (
      await users.find({ where: [{ phone: adminPhone }, { phone: sellerPhone }] })
    ).map((user) => user.id);
    if (cleanupIds.length) {
      await reports
        .createQueryBuilder()
        .delete()
        .where('reporter_id IN (:...ids)', { ids: cleanupIds })
        .execute();
      await listings
        .createQueryBuilder()
        .delete()
        .where('seller_id IN (:...ids)', { ids: cleanupIds })
        .execute();
      await users.delete(cleanupIds);
    }
    await app.close();
  });

  describe('role guard', () => {
    it('rejects an ordinary user from every admin route', async () => {
      await request(app.getHttpServer())
        .get('/api/admin/stats')
        .set('Authorization', `Bearer ${sellerToken}`)
        .expect(403);
    });

    it('rejects anonymous callers', async () => {
      await request(app.getHttpServer()).get('/api/admin/stats').expect(401);
    });

    it('admits an admin', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/admin/stats')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        totalUsers: expect.any(Number),
        activeListings: expect.any(Number),
        openReports: expect.any(Number),
      });
    });
  });

  describe('moderation', () => {
    it('approves a pending listing into the feed with a fresh expiry', async () => {
      const listing = await createListing();
      await listings.update(listing.id, { status: ListingStatus.PENDING });

      const response = await request(app.getHttpServer())
        .post(`/api/admin/listings/${listing.id}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(201);

      expect(response.body.status).toBe(ListingStatus.ACTIVE);
      const days =
        (new Date(response.body.expiresAt).getTime() - Date.now()) / 86_400_000;
      expect(days).toBeGreaterThan(13.9);
    });

    it('refuses to block without a reason', async () => {
      const listing = await createListing();
      await request(app.getHttpServer())
        .post(`/api/admin/listings/${listing.id}/block`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: '' })
        .expect(400);
    });

    it('blocks with a reason the seller can read, and hides it from visitors', async () => {
      const listing = await createListing();

      const blocked = await request(app.getHttpServer())
        .post(`/api/admin/listings/${listing.id}/block`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: "Narx haqiqatga to'g'ri kelmaydi" })
        .expect(201);
      expect(blocked.body.moderationReason).toBe("Narx haqiqatga to'g'ri kelmaydi");

      // Gone for the public...
      await request(app.getHttpServer()).get(`/api/listings/${listing.id}`).expect(404);
      // ...but the owner still sees it, with the reason.
      const own = await request(app.getHttpServer())
        .get(`/api/listings/${listing.id}`)
        .set('Authorization', `Bearer ${sellerToken}`)
        .expect(200);
      expect(own.body.status).toBe(ListingStatus.BLOCKED);
    });

    it('promotes and demotes TOP placement', async () => {
      const listing = await createListing();

      const promoted = await request(app.getHttpServer())
        .post(`/api/admin/listings/${listing.id}/promote`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ days: 7 })
        .expect(201);
      expect(promoted.body.isPromoted).toBe(true);
      expect(new Date(promoted.body.promotedUntil).getTime()).toBeGreaterThan(Date.now());

      const demoted = await request(app.getHttpServer())
        .post(`/api/admin/listings/${listing.id}/promote`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ days: 0 })
        .expect(201);
      expect(demoted.body.isPromoted).toBe(false);
    });

    it('searches listings by seller phone fragment', async () => {
      await createListing();
      const response = await request(app.getHttpServer())
        .get('/api/admin/listings')
        .query({ q: sellerPhone.slice(-7) })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.total).toBeGreaterThan(0);
      for (const item of response.body.items) {
        expect(item.seller.phone).toBe(sellerPhone);
      }
    });
  });

  describe('users', () => {
    it('grants and revokes the verified badge', async () => {
      const verified = await request(app.getHttpServer())
        .post(`/api/admin/users/${sellerId}/verify`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ value: true })
        .expect(201);
      expect(verified.body.isVerified).toBe(true);
    });

    it('blocking a user pulls their active listings and stops their login', async () => {
      const listing = await createListing();

      await request(app.getHttpServer())
        .post(`/api/admin/users/${sellerId}/block`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ value: true })
        .expect(201);

      const pulled = await listings.findOneOrFail({ where: { id: listing.id } });
      expect(pulled.status).toBe(ListingStatus.BLOCKED);

      await redis.del(`otp:rate:${sellerPhone}`);
      await request(app.getHttpServer())
        .post('/api/auth/request-otp')
        .send({ phone: sellerPhone });
      await request(app.getHttpServer())
        .post('/api/auth/verify-otp')
        .send({ phone: sellerPhone, code: '000000' })
        .expect(401);

      // Unblock so the remaining tests keep a working seller.
      await request(app.getHttpServer())
        .post(`/api/admin/users/${sellerId}/block`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ value: false })
        .expect(201);
      sellerToken = await login(sellerPhone);
    });
  });

  describe('reports', () => {
    it('takes a complaint once, answers 409 on a repeat, and lets an admin close it', async () => {
      const listing = await createListing();

      const created = await request(app.getHttpServer())
        .post(`/api/listings/${listing.id}/report`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'wrong_price', comment: 'Narx shubhali' })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/api/listings/${listing.id}/report`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'wrong_price' })
        .expect(409);

      const queue = await request(app.getHttpServer())
        .get('/api/admin/reports')
        .query({ status: 'open' })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(queue.body.items.map((r: { id: string }) => r.id)).toContain(created.body.id);

      const resolved = await request(app.getHttpServer())
        .post(`/api/admin/reports/${created.body.id}/resolve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ outcome: 'resolved', note: "Ko'rib chiqildi" })
        .expect(201);
      expect(resolved.body.status).toBe('resolved');
    });

    it('requires login to complain', async () => {
      const listing = await createListing();
      await request(app.getHttpServer())
        .post(`/api/listings/${listing.id}/report`)
        .send({ reason: 'spam' })
        .expect(401);
    });
  });
});
