import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { User } from '../src/modules/users/entities/user.entity';
import { RedisService } from '../src/redis/redis.service';

/**
 * Full OTP -> JWT journey against the real Postgres and Redis from
 * docker-compose, with SMS_PROVIDER=mock so the code is always 000000.
 */
describe('Auth (e2e)', () => {
  let app: INestApplication;
  let users: Repository<User>;
  let redis: RedisService;

  // Unique per run so repeated runs never collide on the phone unique index.
  const phone = `+99890${Math.floor(1_000_000 + Math.random() * 8_999_999)}`;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api', { exclude: ['health'] });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();

    users = moduleRef.get(getRepositoryToken(User));
    redis = moduleRef.get(RedisService);
  });

  afterAll(async () => {
    await users.delete({ phone });
    await redis.del(`otp:code:${phone}`, `otp:rate:${phone}`);
    await app.close();
  });

  beforeEach(async () => {
    await redis.del(`otp:rate:${phone}`);
  });

  describe('POST /api/auth/request-otp', () => {
    it('rejects a phone that is not +998 followed by 9 digits', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/request-otp')
        .send({ phone: '+7900123456' })
        .expect(400);
    });

    it('accepts a number typed with spaces and dashes', async () => {
      const spaced = phone.replace(/^(\+998)(\d{2})(\d{3})(\d{2})(\d{2})$/, '$1 $2 $3-$4-$5');
      const response = await request(app.getHttpServer())
        .post('/api/auth/request-otp')
        .send({ phone: spaced })
        .expect(200);

      expect(response.body).toMatchObject({ sent: true, expiresIn: expect.any(Number) });
    });

    it('throttles after 3 requests inside the window', async () => {
      for (let i = 0; i < 3; i += 1) {
        await request(app.getHttpServer())
          .post('/api/auth/request-otp')
          .send({ phone })
          .expect(200);
      }
      await request(app.getHttpServer())
        .post('/api/auth/request-otp')
        .send({ phone })
        .expect(429);
    });
  });

  describe('POST /api/auth/verify-otp', () => {
    it('rejects a wrong code', async () => {
      await request(app.getHttpServer()).post('/api/auth/request-otp').send({ phone });

      await request(app.getHttpServer())
        .post('/api/auth/verify-otp')
        .send({ phone, code: '123456' })
        .expect(401);
    });

    it('creates the account on first login and returns a token pair', async () => {
      await request(app.getHttpServer()).post('/api/auth/request-otp').send({ phone });

      const response = await request(app.getHttpServer())
        .post('/api/auth/verify-otp')
        .send({ phone, code: '000000', name: 'Anvar aka' })
        .expect(200);

      expect(response.body).toMatchObject({
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
        isNewUser: true,
      });

      const created = await users.findOne({ where: { phone } });
      expect(created?.name).toBe('Anvar aka');
    });

    it('reports isNewUser=false on a subsequent login', async () => {
      await request(app.getHttpServer()).post('/api/auth/request-otp').send({ phone });

      const response = await request(app.getHttpServer())
        .post('/api/auth/verify-otp')
        .send({ phone, code: '000000' })
        .expect(200);

      expect(response.body.isNewUser).toBe(false);
    });
  });

  describe('authenticated routes', () => {
    let accessToken: string;
    let refreshToken: string;

    beforeEach(async () => {
      await request(app.getHttpServer()).post('/api/auth/request-otp').send({ phone });
      const response = await request(app.getHttpServer())
        .post('/api/auth/verify-otp')
        .send({ phone, code: '000000' });
      accessToken = response.body.accessToken;
      refreshToken = response.body.refreshToken;
    });

    it('GET /api/auth/me returns the user for a valid token', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toMatchObject({ phone });
    });

    it('GET /api/auth/me is rejected without a token', async () => {
      await request(app.getHttpServer()).get('/api/auth/me').expect(401);
    });

    it('GET /api/auth/me is rejected with a garbage token', async () => {
      await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', 'Bearer not-a-jwt')
        .expect(401);
    });

    it('refresh rotates the pair', async () => {
      const rotated = await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(rotated.body.refreshToken).not.toBe(refreshToken);
      refreshToken = rotated.body.refreshToken;
    });

    /**
     * Two tabs whose access tokens expire in the same second both present the
     * same refresh token. Before the grace window the loser was treated as a
     * thief and the account was signed out everywhere — for opening two tabs.
     */
    it('serves a second use of a just-rotated token instead of killing the session', async () => {
      const first = await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      const second = await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(second.body.refreshToken).not.toBe(first.body.refreshToken);

      // The winner's token still works: nothing was revoked.
      await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .send({ refreshToken: first.body.refreshToken })
        .expect(200);
    });

    it('burns the old token once the grace window has passed', async () => {
      const rotated = await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      // Standing in for sixty seconds of clock. Deleting the grace marker is
      // exactly what its TTL does, and it keeps the test instant.
      await redis.delByPattern('auth:rotated:*');

      await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(401);

      // A replay is a compromise: everything the account holds goes, including
      // the pair that was legitimately issued a moment ago.
      await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .send({ refreshToken: rotated.body.refreshToken })
        .expect(401);

      // Leave a live session behind for the logout test that follows.
      await redis.del(`otp:rate:${phone}`);
      await request(app.getHttpServer())
        .post('/api/auth/request-otp')
        .send({ phone })
        .expect(200);
      refreshToken = (
        await request(app.getHttpServer())
          .post('/api/auth/verify-otp')
          .send({ phone, code: '000000' })
          .expect(200)
      ).body.refreshToken;
    });

    it('PATCH /api/auth/me updates the name and location', async () => {
      const regions = await request(app.getHttpServer()).get('/api/regions');
      const region = regions.body.find((r: { slug: string }) => r.slug === 'samarqand');
      const districts = await request(app.getHttpServer()).get(
        `/api/regions/${region.id}/districts`,
      );
      const district = districts.body.find((d: { slug: string }) => d.slug === 'urgut');

      const response = await request(app.getHttpServer())
        .patch('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Yangi Ism', regionId: region.id, districtId: district.id })
        .expect(200);

      expect(response.body).toMatchObject({
        name: 'Yangi Ism',
        regionId: region.id,
        districtId: district.id,
      });
    });

    it('PATCH /api/auth/me rejects a district outside the region', async () => {
      const regions = await request(app.getHttpServer()).get('/api/regions');
      const samarqand = regions.body.find((r: { slug: string }) => r.slug === 'samarqand');
      const andijon = regions.body.find((r: { slug: string }) => r.slug === 'andijon');
      const andijonDistricts = await request(app.getHttpServer()).get(
        `/api/regions/${andijon.id}/districts`,
      );

      await request(app.getHttpServer())
        .patch('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ regionId: samarqand.id, districtId: andijonDistricts.body[0].id })
        .expect(400);
    });

    it('logout blacklists the access token', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ refreshToken })
        .expect(204);

      await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(401);
    });
  });

  describe('public routes', () => {
    it('GET /api/categories needs no token', async () => {
      const response = await request(app.getHttpServer()).get('/api/categories').expect(200);
      expect(response.body).toHaveLength(12);
    });

    it('GET /api/regions needs no token', async () => {
      const response = await request(app.getHttpServer()).get('/api/regions').expect(200);
      expect(response.body).toHaveLength(14);
    });
  });
});
