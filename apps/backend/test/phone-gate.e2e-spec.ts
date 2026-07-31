import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { AuthIdentity, AuthProvider } from '../src/modules/auth/entities/auth-identity.entity';
import { TokenService } from '../src/modules/auth/token.service';
import { Category } from '../src/modules/catalog/entities/category.entity';
import { District } from '../src/modules/geo/entities/district.entity';
import { Region } from '../src/modules/geo/entities/region.entity';
import { Listing } from '../src/modules/listings/entities/listing.entity';
import { User, UserRole } from '../src/modules/users/entities/user.entity';
import { RedisService } from '../src/redis/redis.service';

/**
 * The line between browsing and participating.
 *
 * A Google account with no phone can read the whole marketplace and must be
 * refused every action that reaches another person. Getting this wrong in
 * either direction is expensive: too strict and we charge ourselves an SMS to
 * turn a browsing buyer away, too loose and an unreachable stranger can post
 * listings and message sellers.
 */
describe('Phone verification gate (e2e)', () => {
  let app: INestApplication;
  let users: Repository<User>;
  let identities: Repository<AuthIdentity>;
  let listings: Repository<Listing>;
  let tokens: TokenService;
  let redis: RedisService;

  const googlePhone = `+99896${Math.floor(1_000_000 + Math.random() * 8_999_999)}`;
  let browserId: string;
  let browserToken: string;
  let categoryId: string;
  let regionId: string;
  let districtId: string;
  let listingId: string;
  const created: string[] = [];

  const listingBody = () => ({
    title: `Gate testi ${Math.random().toString(36).slice(2, 8)}`,
    categoryId,
    quantity: 12,
    quantityUnit: 't',
    price: 14_000,
    priceUnit: 'kg',
    regionId,
    districtId,
  });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api', { exclude: ['health'] });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();

    users = moduleRef.get(getRepositoryToken(User));
    identities = moduleRef.get(getRepositoryToken(AuthIdentity));
    listings = moduleRef.get(getRepositoryToken(Listing));
    tokens = moduleRef.get(TokenService);
    redis = moduleRef.get(RedisService);

    const categories: Repository<Category> = moduleRef.get(getRepositoryToken(Category));
    const regions: Repository<Region> = moduleRef.get(getRepositoryToken(Region));
    const districts: Repository<District> = moduleRef.get(getRepositoryToken(District));

    categoryId = (await categories.findOneOrFail({ where: { slug: 'sabzavotlar' } })).id;
    regionId = (await regions.findOneOrFail({ where: { slug: 'samarqand' } })).id;
    districtId = (await districts.findOneOrFail({ where: { regionId, slug: 'urgut' } })).id;

    // Exactly what a Google sign-in produces: an account with no phone.
    const browser = await users.save(
      users.create({ name: 'Google Xaridor', email: 'browser@example.com', role: UserRole.USER }),
    );
    browserId = browser.id;
    await identities.save(
      identities.create({
        userId: browser.id,
        provider: AuthProvider.GOOGLE,
        providerUserId: `google-${browser.id}`,
      }),
    );
    browserToken = (await tokens.issuePair(browser)).accessToken;

    // A listing to try to interact with, owned by somebody else.
    const seller = await users.save(
      users.create({
        phone: `+99895${Math.floor(1_000_000 + Math.random() * 8_999_999)}`,
        phoneVerifiedAt: new Date(),
        role: UserRole.USER,
      }),
    );
    const listing = await listings.save(
      listings.create({
        ...listingBody(),
        sellerId: seller.id,
        quantity: '12.000',
        price: '14000.00',
        quantityUnit: 't' as never,
        priceUnit: 'kg' as never,
        attributes: {},
      }),
    );
    listingId = listing.id;
    created.push(listing.id, seller.id);
  });

  afterAll(async () => {
    await listings.delete({ id: listingId });
    await users.delete({ id: browserId });
    await users.delete({ phone: googlePhone });
    for (const id of created) await users.delete({ id }).catch(() => undefined);
    await redis.delByPattern('otp:*');
    await app.close();
  });

  describe('browsing needs no phone', () => {
    it('reads the feed', async () => {
      await request(app.getHttpServer())
        .get('/api/listings')
        .set('Authorization', `Bearer ${browserToken}`)
        .expect(200);
    });

    it('opens a listing', async () => {
      await request(app.getHttpServer())
        .get(`/api/listings/${listingId}`)
        .set('Authorization', `Bearer ${browserToken}`)
        .expect(200);
    });

    it('reads its own profile', async () => {
      const { body } = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${browserToken}`)
        .expect(200);

      expect(body.phone).toBeNull();
    });

    it('searches', async () => {
      await request(app.getHttpServer())
        .post('/api/ai/search')
        .set('Authorization', `Bearer ${browserToken}`)
        .send({ q: 'pomidor' })
        .expect(201);
    });
  });

  describe('participating needs a verified phone', () => {
    const gated: Array<[string, () => request.Test]> = [
      [
        'post a listing',
        () =>
          request(app.getHttpServer())
            .post('/api/listings')
            .set('Authorization', `Bearer ${browserToken}`)
            .send(listingBody()),
      ],
      [
        'open a chat',
        () =>
          request(app.getHttpServer())
            .post(`/api/listings/${listingId}/chat`)
            .set('Authorization', `Bearer ${browserToken}`),
      ],
      [
        'save a favourite',
        () =>
          request(app.getHttpServer())
            .post(`/api/listings/${listingId}/favorite`)
            .set('Authorization', `Bearer ${browserToken}`),
      ],
      [
        'edit the profile',
        () =>
          request(app.getHttpServer())
            .patch('/api/auth/me')
            .set('Authorization', `Bearer ${browserToken}`)
            .send({ name: 'Yangi ism' }),
      ],
    ];

    it.each(gated)('refuses to %s', async (_label, call) => {
      const { body } = await call().expect(403);

      // A machine-readable code, not just a message: the client has to tell
      // "verify your phone" apart from "this is not yours" and open the
      // verification sheet for one and not the other.
      expect(body.error).toBe('PHONE_VERIFICATION_REQUIRED');
    });
  });

  describe('POST /api/auth/phone/verify', () => {
    it('attaches the phone, records the identity and reissues the token', async () => {
      await redis.del(`otp:rate:${googlePhone}`);
      await request(app.getHttpServer())
        .post('/api/auth/phone/request')
        .set('Authorization', `Bearer ${browserToken}`)
        .send({ phone: googlePhone })
        .expect(200);

      const { body } = await request(app.getHttpServer())
        .post('/api/auth/phone/verify')
        .set('Authorization', `Bearer ${browserToken}`)
        .send({ phone: googlePhone, code: '000000' })
        .expect(200);

      expect(body.accessToken).toBeDefined();

      const user = await users.findOneOrFail({ where: { id: browserId } });
      expect(user.phone).toBe(googlePhone);
      expect(user.phoneVerifiedAt).not.toBeNull();

      // Both proofs now resolve to one account rather than two.
      const rows = await identities.find({ where: { userId: browserId } });
      expect(rows.map((row) => row.provider).sort()).toEqual(['google', 'phone']);

      // The old token still says unverified, which is why a fresh pair is
      // returned — the button the person just unblocked has to work now, not
      // after the next refresh.
      browserToken = body.accessToken;
    });

    it('lets the same account post once verified', async () => {
      const { body } = await request(app.getHttpServer())
        .post('/api/listings')
        .set('Authorization', `Bearer ${browserToken}`)
        .send(listingBody())
        .expect(201);

      await listings.delete({ id: body.id });
    });

    it('refuses a phone already attached to another account', async () => {
      // Merging silently would move listings between accounts.
      const other = await users.save(
        users.create({
          phone: `+99894${Math.floor(1_000_000 + Math.random() * 8_999_999)}`,
          phoneVerifiedAt: new Date(),
          role: UserRole.USER,
        }),
      );
      created.push(other.id);

      const fresh = await users.save(
        users.create({ name: 'Ikkinchi', role: UserRole.USER }),
      );
      created.push(fresh.id);
      const token = (await tokens.issuePair(fresh)).accessToken;

      await redis.del(`otp:rate:${other.phone!}`);
      await request(app.getHttpServer())
        .post('/api/auth/phone/request')
        .set('Authorization', `Bearer ${token}`)
        .send({ phone: other.phone })
        .expect(200);

      const { body } = await request(app.getHttpServer())
        .post('/api/auth/phone/verify')
        .set('Authorization', `Bearer ${token}`)
        .send({ phone: other.phone, code: '000000' })
        .expect(400);

      expect(body.message).toContain('boshqa hisobga');
    });
  });

  describe('POST /api/auth/logout-all', () => {
    it('invalidates every refresh token the account holds', async () => {
      const user = await users.save(users.create({ name: 'Ko‘p qurilma', role: UserRole.USER }));
      created.push(user.id);

      const phone = (await tokens.issuePair(user)).refreshToken;
      const laptop = (await tokens.issuePair(user)).refreshToken;

      await request(app.getHttpServer())
        .post('/api/auth/logout-all')
        .set('Authorization', `Bearer ${(await tokens.issuePair(user)).accessToken}`)
        .expect(204);

      for (const token of [phone, laptop]) {
        await request(app.getHttpServer())
          .post('/api/auth/refresh')
          .send({ refreshToken: token })
          .expect(401);
      }
    });
  });

  describe('POST /api/auth/google', () => {
    it('rejects a token that is not a Google ID token', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/google')
        .send({ idToken: 'a'.repeat(64) })
        .expect(401);
    });

    it('validates the body', async () => {
      await request(app.getHttpServer()).post('/api/auth/google').send({}).expect(400);
    });
  });
});
