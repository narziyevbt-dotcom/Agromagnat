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
import { DeviceToken } from '../src/modules/notifications/entities/device-token.entity';
import { User } from '../src/modules/users/entities/user.entity';
import { RedisService } from '../src/redis/redis.service';

/** Conversations, unread badges and device registration against real infrastructure. */
describe('Chat (e2e)', () => {
  let app: INestApplication;
  let users: Repository<User>;
  let listings: Repository<Listing>;
  let devices: Repository<DeviceToken>;
  let redis: RedisService;

  const sellerPhone = `+99894${Math.floor(1_000_000 + Math.random() * 8_999_999)}`;
  const buyerPhone = `+99895${Math.floor(1_000_000 + Math.random() * 8_999_999)}`;
  const strangerPhone = `+99897${Math.floor(1_000_000 + Math.random() * 8_999_999)}`;

  let sellerToken: string;
  let buyerToken: string;
  let strangerToken: string;
  let listingId: string;
  let chatId: string;

  const login = async (phone: string): Promise<string> => {
    await redis.del(`otp:rate:${phone}`);
    await request(app.getHttpServer()).post('/api/auth/request-otp').send({ phone });
    const response = await request(app.getHttpServer())
      .post('/api/auth/verify-otp')
      .send({ phone, code: '000000', name: 'Test' });
    return response.body.accessToken;
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
    devices = moduleRef.get(getRepositoryToken(DeviceToken));
    redis = moduleRef.get(RedisService);

    const categoryRepo: Repository<Category> = moduleRef.get(getRepositoryToken(Category));
    const regionRepo: Repository<Region> = moduleRef.get(getRepositoryToken(Region));
    const districtRepo: Repository<District> = moduleRef.get(getRepositoryToken(District));

    const category = (await categoryRepo.find({ order: { sortOrder: 'ASC' }, take: 1 }))[0];
    const region = await regionRepo.findOneOrFail({ where: { slug: 'samarqand' } });
    const district = await districtRepo.findOneOrFail({
      where: { regionId: region.id, slug: 'urgut' },
    });

    sellerToken = await login(sellerPhone);
    buyerToken = await login(buyerPhone);
    strangerToken = await login(strangerPhone);

    const created = await request(app.getHttpServer())
      .post('/api/listings')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({
        title: `Chat test pomidor ${Math.random().toString(36).slice(2, 8)}`,
        categoryId: category.id,
        quantity: 12,
        quantityUnit: 't',
        price: 14000,
        priceUnit: 'kg',
        regionId: region.id,
        districtId: district.id,
      })
      .expect(201);

    listingId = created.body.id;
  });

  afterAll(async () => {
    await listings.delete(listingId);
    for (const phone of [sellerPhone, buyerPhone, strangerPhone]) {
      const user = await users.findOne({ where: { phone } });
      if (user) {
        await devices.delete({ userId: user.id });
        await users.delete(user.id);
      }
      await redis.del(`otp:rate:${phone}`);
    }
    await redis.delByPattern('feed:v1:*');
    await app.close();
  });

  describe('POST /api/listings/:id/chat', () => {
    it('requires authentication', async () => {
      await request(app.getHttpServer()).post(`/api/listings/${listingId}/chat`).expect(401);
    });

    it('opens a conversation for the buyer', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/listings/${listingId}/chat`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(200);

      expect(response.body).toMatchObject({ listingId });
      chatId = response.body.id;
    });

    it('returns the same conversation on a second tap', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/listings/${listingId}/chat`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(200);

      expect(response.body.id).toBe(chatId);
    });

    it('refuses the seller writing to their own listing', async () => {
      await request(app.getHttpServer())
        .post(`/api/listings/${listingId}/chat`)
        .set('Authorization', `Bearer ${sellerToken}`)
        .expect(400);
    });
  });

  describe('POST /api/chats/:id/messages', () => {
    it('rejects an empty message', async () => {
      await request(app.getHttpServer())
        .post(`/api/chats/${chatId}/messages`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ body: '' })
        .expect(400);
    });

    it('rejects an unknown field rather than silently dropping it', async () => {
      await request(app.getHttpServer())
        .post(`/api/chats/${chatId}/messages`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ body: 'Salom', senderId: 'someone-else' })
        .expect(400);
    });

    it('stores the buyer\'s message', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/chats/${chatId}/messages`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ body: 'Assalomu alaykum, narxi kelishiladimi?' })
        .expect(201);

      expect(response.body).toMatchObject({
        body: 'Assalomu alaykum, narxi kelishiladimi?',
        type: 'text',
      });
    });

    it('stores a message with the same clientId only once', async () => {
      const clientId = `client-${Math.random().toString(36).slice(2, 12)}`;
      const payload = { body: 'Offline yuborilgan xabar', clientId };

      const first = await request(app.getHttpServer())
        .post(`/api/chats/${chatId}/messages`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send(payload)
        .expect(201);

      const retry = await request(app.getHttpServer())
        .post(`/api/chats/${chatId}/messages`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send(payload)
        .expect(201);

      expect(retry.body.id).toBe(first.body.id);
    });

    it('hides the conversation from a stranger', async () => {
      await request(app.getHttpServer())
        .post(`/api/chats/${chatId}/messages`)
        .set('Authorization', `Bearer ${strangerToken}`)
        .send({ body: 'Kim bu?' })
        .expect(404);
    });
  });

  describe('GET /api/chats', () => {
    it('shows the thread to the seller with an unread badge', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/chats')
        .set('Authorization', `Bearer ${sellerToken}`)
        .expect(200);

      const thread = response.body.find((chat: { id: string }) => chat.id === chatId);
      expect(thread).toMatchObject({ role: 'seller', listingId });
      expect(thread.unreadCount).toBeGreaterThan(0);
      expect(thread.counterpart.phone).toBe(buyerPhone);
    });

    it('shows the buyer no unread messages of their own', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/chats')
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(200);

      const thread = response.body.find((chat: { id: string }) => chat.id === chatId);
      expect(thread).toMatchObject({ role: 'buyer', unreadCount: 0 });
    });

    it('leaves a stranger with an empty inbox', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/chats')
        .set('Authorization', `Bearer ${strangerToken}`)
        .expect(200);

      expect(response.body).toEqual([]);
    });
  });

  describe('GET /api/chats/:id/messages', () => {
    it('returns history newest first', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/chats/${chatId}/messages`)
        .set('Authorization', `Bearer ${sellerToken}`)
        .expect(200);

      expect(response.body.items.length).toBeGreaterThanOrEqual(2);
      const [newest, next] = response.body.items;
      expect(new Date(newest.createdAt).getTime()).toBeGreaterThanOrEqual(
        new Date(next.createdAt).getTime(),
      );
    });

    it('pages backwards with the cursor', async () => {
      const first = await request(app.getHttpServer())
        .get(`/api/chats/${chatId}/messages`)
        .query({ limit: 1 })
        .set('Authorization', `Bearer ${sellerToken}`)
        .expect(200);

      expect(first.body.hasMore).toBe(true);

      const second = await request(app.getHttpServer())
        .get(`/api/chats/${chatId}/messages`)
        .query({ limit: 1, cursor: first.body.nextCursor })
        .set('Authorization', `Bearer ${sellerToken}`)
        .expect(200);

      expect(second.body.items[0].id).not.toBe(first.body.items[0].id);
    });

    it('hides history from a stranger', async () => {
      await request(app.getHttpServer())
        .get(`/api/chats/${chatId}/messages`)
        .set('Authorization', `Bearer ${strangerToken}`)
        .expect(404);
    });
  });

  describe('POST /api/chats/:id/read', () => {
    it('clears the seller badge without touching the buyer side', async () => {
      const before = await request(app.getHttpServer())
        .get('/api/chats/unread-count')
        .set('Authorization', `Bearer ${sellerToken}`)
        .expect(200);
      expect(before.body.unread).toBeGreaterThan(0);

      await request(app.getHttpServer())
        .post(`/api/chats/${chatId}/read`)
        .set('Authorization', `Bearer ${sellerToken}`)
        .expect(200);

      const after = await request(app.getHttpServer())
        .get('/api/chats/unread-count')
        .set('Authorization', `Bearer ${sellerToken}`)
        .expect(200);
      expect(after.body.unread).toBe(0);
    });

    it('gives the buyer a badge when the seller replies', async () => {
      await request(app.getHttpServer())
        .post(`/api/chats/${chatId}/messages`)
        .set('Authorization', `Bearer ${sellerToken}`)
        .send({ body: 'Ha, kelishamiz' })
        .expect(201);

      const response = await request(app.getHttpServer())
        .get('/api/chats/unread-count')
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(200);

      expect(response.body.unread).toBe(1);
    });
  });

  describe('/api/me/devices', () => {
    const token = `fcm-token-${Math.random().toString(36).slice(2, 14)}`;

    it('requires authentication', async () => {
      await request(app.getHttpServer()).post('/api/me/devices').send({ token }).expect(401);
    });

    it('rejects a token that is obviously not one', async () => {
      await request(app.getHttpServer())
        .post('/api/me/devices')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ token: 'short' })
        .expect(400);
    });

    it('registers a device once, however many times it is sent', async () => {
      await request(app.getHttpServer())
        .post('/api/me/devices')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ token, platform: 'android' })
        .expect(200);

      await request(app.getHttpServer())
        .post('/api/me/devices')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ token, platform: 'android' })
        .expect(200);

      expect(await devices.count({ where: { token } })).toBe(1);
    });

    it('unregisters on logout', async () => {
      await request(app.getHttpServer())
        .delete('/api/me/devices')
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ token })
        .expect(204);

      expect(await devices.count({ where: { token } })).toBe(0);
    });
  });
});
