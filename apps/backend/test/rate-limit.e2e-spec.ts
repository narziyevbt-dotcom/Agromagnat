import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { TokenService } from '../src/modules/auth/token.service';
import { Category } from '../src/modules/catalog/entities/category.entity';
import { District } from '../src/modules/geo/entities/district.entity';
import { Listing } from '../src/modules/listings/entities/listing.entity';
import { Region } from '../src/modules/geo/entities/region.entity';
import { User, UserRole } from '../src/modules/users/entities/user.entity';
import { RedisService } from '../src/redis/redis.service';

/**
 * The cap on writing.
 *
 * A marketplace with an uncapped "create listing" is one loop away from a
 * catalogue nobody can search, and the day that matters is the day the site is
 * advertised. Reads stay uncapped on purpose: browsing is the product, and a
 * cap there turns a farmer on a retrying connection into a locked-out one.
 */
describe('Write rate limits (e2e)', () => {
  let app: INestApplication;
  let users: Repository<User>;
  let listings: Repository<Listing>;
  let redis: RedisService;
  let tokens: TokenService;

  let token: string;
  let userId: string;
  let body: Record<string, unknown>;
  const created: string[] = [];

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
    tokens = moduleRef.get(TokenService);

    const categories: Repository<Category> = moduleRef.get(getRepositoryToken(Category));
    const regions: Repository<Region> = moduleRef.get(getRepositoryToken(Region));
    const districts: Repository<District> = moduleRef.get(getRepositoryToken(District));

    const region = await regions.findOneOrFail({ where: { slug: 'samarqand' } });
    const district = await districts.findOneOrFail({
      where: { regionId: region.id, slug: 'urgut' },
    });
    const category = await categories.findOneOrFail({ where: { slug: 'sabzavotlar' } });

    const user = await users.save(
      users.create({
        phone: `+99893${Math.floor(1_000_000 + Math.random() * 8_999_999)}`,
        phoneVerifiedAt: new Date(),
        name: 'Limit testi',
        role: UserRole.USER,
      }),
    );
    userId = user.id;
    token = (await tokens.issuePair(user)).accessToken;

    body = {
      title: 'Limit testi uchun elon',
      categoryId: category.id,
      quantity: 5,
      quantityUnit: 't',
      price: 10_000,
      priceUnit: 'kg',
      regionId: region.id,
      districtId: district.id,
    };
  });

  afterAll(async () => {
    for (const id of created) await listings.delete({ id }).catch(() => undefined);
    await users.delete({ id: userId });
    await redis.delByPattern('rate:*');
    await app.close();
  });

  beforeEach(async () => {
    await redis.delByPattern(`rate:*:${userId}`);
  });

  it('lets an ordinary seller post', async () => {
    const { body: listing } = await request(app.getHttpServer())
      .post('/api/listings')
      .set('Authorization', `Bearer ${token}`)
      .send(body)
      .expect(201);

    created.push(listing.id);
  });

  it('refuses the twenty-first listing in an hour', async () => {
    // Nobody harvests twenty different crops an hour. A script does.
    for (let i = 0; i < 20; i += 1) {
      const response = await request(app.getHttpServer())
        .post('/api/listings')
        .set('Authorization', `Bearer ${token}`)
        .send({ ...body, title: `Limit testi ${i}` });
      expect(response.status).toBe(201);
      created.push(response.body.id);
    }

    await request(app.getHttpServer())
      .post('/api/listings')
      .set('Authorization', `Bearer ${token}`)
      .send(body)
      .expect(429);
  });

  it('shares the budget between posting and editing', async () => {
    // Otherwise a bot posts to its limit and then rewrites those listings into
    // twenty more, which is the same abuse with an extra step.
    const { body: listing } = await request(app.getHttpServer())
      .post('/api/listings')
      .set('Authorization', `Bearer ${token}`)
      .send(body)
      .expect(201);
    created.push(listing.id);

    for (let i = 0; i < 19; i += 1) {
      await request(app.getHttpServer())
        .patch(`/api/listings/${listing.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: `O'zgartirildi ${i}` })
        .expect(200);
    }

    await request(app.getHttpServer())
      .patch(`/api/listings/${listing.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Yigirma birinchi' })
      .expect(429);
  });

  it('does not cap browsing', async () => {
    // The cap must never reach a read. A farmer refreshing a feed on a bad
    // connection is the most normal thing on the site.
    for (let i = 0; i < 25; i += 1) {
      await request(app.getHttpServer())
        .get('/api/listings')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    }
  });

  it('counts per account, not globally', async () => {
    // Sharing a bucket across accounts would mean one abuser silencing the
    // whole market — and behind a carrier NAT, one address is a whole village.
    const other = await users.save(
      users.create({
        phone: `+99891${Math.floor(1_000_000 + Math.random() * 8_999_999)}`,
        phoneVerifiedAt: new Date(),
        role: UserRole.USER,
      }),
    );
    const otherToken = (await tokens.issuePair(other)).accessToken;

    for (let i = 0; i < 20; i += 1) {
      const response = await request(app.getHttpServer())
        .post('/api/listings')
        .set('Authorization', `Bearer ${token}`)
        .send({ ...body, title: `Birinchi hisob ${i}` });
      created.push(response.body.id);
    }
    await request(app.getHttpServer())
      .post('/api/listings')
      .set('Authorization', `Bearer ${token}`)
      .send(body)
      .expect(429);

    const { body: listing } = await request(app.getHttpServer())
      .post('/api/listings')
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ ...body, title: 'Ikkinchi hisob' })
      .expect(201);

    created.push(listing.id);
    await redis.delByPattern(`rate:*:${other.id}`);
    await users.delete({ id: other.id });
  });
});
