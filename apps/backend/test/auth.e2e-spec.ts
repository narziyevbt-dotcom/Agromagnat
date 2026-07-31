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

    it('refresh rotates the pair and burns the old refresh token', async () => {
      const rotated = await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(rotated.body.refreshToken).not.toBe(refreshToken);

      await request(app.getHttpServer())
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(401);
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
