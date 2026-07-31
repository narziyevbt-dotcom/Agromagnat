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
import { User } from '../src/modules/users/entities/user.entity';
import { RedisService } from '../src/redis/redis.service';

/**
 * The AI endpoints and the category-aware posting rules, against real Postgres
 * and Redis.
 *
 * The suite runs on `AI_PROVIDER=local`, which is the point rather than a
 * limitation: the keyword provider is what ships by default, it is what the
 * Anthropic provider falls back to, and it is the only one that can be asserted
 * on deterministically. The model path is exercised by hand — see docs/AI.md.
 */
describe('AI and category forms (e2e)', () => {
  let app: INestApplication;
  let users: Repository<User>;
  let listings: Repository<Listing>;
  let redis: RedisService;

  const phone = `+99894${Math.floor(1_000_000 + Math.random() * 8_999_999)}`;
  let token: string;
  let machineryId: string;
  let produceId: string;
  let landId: string;
  let regionId: string;
  let districtId: string;
  const created: string[] = [];

  const post = async (body: Record<string, unknown>, expected: number) => {
    const response = await request(app.getHttpServer())
      .post('/api/listings')
      .set('Authorization', `Bearer ${token}`)
      .send(body)
      .expect(expected);
    if (response.body?.id) created.push(response.body.id);
    return response;
  };

  const machinery = (overrides: Record<string, unknown> = {}) => ({
    title: 'MTZ-82 traktor sotiladi',
    categoryId: machineryId,
    quantity: 1,
    quantityUnit: 'dona',
    price: 85_000_000,
    priceUnit: 'dona',
    regionId,
    districtId,
    attributes: { condition: 'used' },
    ...overrides,
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
    listings = moduleRef.get(getRepositoryToken(Listing));
    redis = moduleRef.get(RedisService);

    const categories: Repository<Category> = moduleRef.get(getRepositoryToken(Category));
    const regions: Repository<Region> = moduleRef.get(getRepositoryToken(Region));
    const districts: Repository<District> = moduleRef.get(getRepositoryToken(District));

    machineryId = (await categories.findOneOrFail({ where: { slug: 'texnika' } })).id;
    produceId = (await categories.findOneOrFail({ where: { slug: 'sabzavotlar' } })).id;
    landId = (await categories.findOneOrFail({ where: { slug: 'yer' } })).id;

    regionId = (await regions.findOneOrFail({ where: { slug: 'samarqand' } })).id;
    districtId = (await districts.findOneOrFail({ where: { regionId, slug: 'urgut' } })).id;

    await redis.del(`otp:rate:${phone}`);
    await request(app.getHttpServer()).post('/api/auth/request-otp').send({ phone });
    token = (
      await request(app.getHttpServer())
        .post('/api/auth/verify-otp')
        .send({ phone, code: '000000', name: 'AI Test' })
    ).body.accessToken;
  });

  afterAll(async () => {
    if (created.length) await listings.delete(created);
    await users.delete({ phone });
    await redis.delByPattern('ai:*');
    await redis.del('catalog:categories');
    await app.close();
  });

  describe('GET /api/categories/:idOrSlug/form', () => {
    it('is public — the posting form is rendered before the token is checked', async () => {
      await request(app.getHttpServer()).get('/api/categories/texnika/form').expect(200);
    });

    it('never offers a weight for machinery', async () => {
      const { body } = await request(app.getHttpServer())
        .get('/api/categories/texnika/form')
        .expect(200);

      expect(body.kind).toBe('machinery');
      expect(body.quantity.units).toEqual(['dona']);
      expect(body.quantity.labelUz).toBe('Nechta');
      expect(body.optional.harvestDate).toBe(false);
      expect(body.attributes.map((a: { key: string }) => a.key)).toContain('condition');
    });

    it('keeps the harvest date on produce, where it means something', async () => {
      const { body } = await request(app.getHttpServer())
        .get('/api/categories/sabzavotlar/form')
        .expect(200);

      expect(body.optional.harvestDate).toBe(true);
      expect(body.quantity.units).toContain('kg');
    });

    it('resolves by id as well as by slug', async () => {
      const { body } = await request(app.getHttpServer())
        .get(`/api/categories/${landId}/form`)
        .expect(200);
      expect(body.kind).toBe('land');
    });

    it('404s on an unknown category', async () => {
      await request(app.getHttpServer()).get('/api/categories/yoq/form').expect(404);
    });
  });

  describe('GET /api/categories', () => {
    it('carries the form spec on every row, so one request builds the whole form', async () => {
      const { body } = await request(app.getHttpServer()).get('/api/categories').expect(200);

      expect(body).toHaveLength(12);
      for (const category of body) {
        expect(category.kind).toBeDefined();
        expect(category.form.quantity.units.length).toBeGreaterThan(0);
      }
    });
  });

  describe('category-aware listing validation', () => {
    it('publishes a valid machinery listing', async () => {
      const { body } = await post(
        machinery({ attributes: { condition: 'used', year: 2018, brand: 'MTZ-82' } }),
        201,
      );
      expect(body.attributes).toEqual({ condition: 'used', year: 2018, brand: 'MTZ-82' });
    });

    it('rejects a weight on machinery, in Uzbek', async () => {
      const { body } = await post(machinery({ quantityUnit: 'kg' }), 400);
      expect(body.message).toContain("o'lchov birligi mos emas");
    });

    it('rejects a harvest date on machinery', async () => {
      const { body } = await post(machinery({ harvestDate: '2026-07-01' }), 400);
      expect(body.message).toContain('hosil sanasi');
    });

    it('rejects a missing required attribute', async () => {
      const { body } = await post(machinery({ attributes: {} }), 400);
      expect(body.message).toBe('Holati tanlanmagan');
    });

    it('rejects an out-of-range attribute', async () => {
      const { body } = await post(
        machinery({ attributes: { condition: 'new', year: 1899 } }),
        400,
      );
      expect(body.message).toContain('1950');
    });

    it('drops an attribute the spec does not declare instead of failing the listing', async () => {
      // A client one release behind keeps sending a renamed field; refusing the
      // listing over it would break posting for everyone who has not updated.
      const { body } = await post(
        machinery({ attributes: { condition: 'new', horsepower: 80 } }),
        201,
      );
      expect(body.attributes).toEqual({ condition: 'new' });
    });

    it('re-validates against the new category when a listing is moved', async () => {
      const { body: created201 } = await post(
        {
          title: 'Urgut pomidori, 1-nav',
          categoryId: produceId,
          quantity: 12,
          quantityUnit: 't',
          price: 14_000,
          priceUnit: 'kg',
          regionId,
          districtId,
          harvestDate: '2026-07-20',
        },
        201,
      );

      // Tonnes are fine for produce and impossible for machinery — a patch-only
      // check would wave this through because the unit is not in the patch.
      const { body } = await request(app.getHttpServer())
        .patch(`/api/listings/${created201.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ categoryId: machineryId })
        .expect(400);

      expect(body.message).toContain("o'lchov birligi mos emas");
    });
  });

  describe('POST /api/ai/category', () => {
    it('requires a token — these calls cost money and the limit is per user', async () => {
      await request(app.getHttpServer())
        .post('/api/ai/category')
        .send({ text: 'pomidor' })
        .expect(401);
    });

    it('resolves a product name to a real category id', async () => {
      const { body } = await request(app.getHttpServer())
        .post('/api/ai/category')
        .set('Authorization', `Bearer ${token}`)
        .send({ text: '12 tonna pomidor sotiladi' })
        .expect(201);

      expect(body.source).toBe('keyword');
      expect(body.candidates[0].categoryId).toBe(produceId);
    });

    it('picks machinery for a tractor', async () => {
      const { body } = await request(app.getHttpServer())
        .post('/api/ai/category')
        .set('Authorization', `Bearer ${token}`)
        .send({ text: 'MTZ-82 traktor' })
        .expect(201);

      expect(body.candidates[0].categoryId).toBe(machineryId);
    });

    it('returns nothing rather than guessing', async () => {
      const { body } = await request(app.getHttpServer())
        .post('/api/ai/category')
        .set('Authorization', `Bearer ${token}`)
        .send({ text: 'salom qalaysiz' })
        .expect(201);

      expect(body.candidates).toEqual([]);
    });

    it('rejects text too short to classify', async () => {
      await request(app.getHttpServer())
        .post('/api/ai/category')
        .set('Authorization', `Bearer ${token}`)
        .send({ text: 'a' })
        .expect(400);
    });
  });

  describe('POST /api/ai/draft', () => {
    it('fills the form from one sentence', async () => {
      const { body } = await request(app.getHttpServer())
        .post('/api/ai/draft')
        .set('Authorization', `Bearer ${token}`)
        .send({ text: "Urgutdan 12 tonna pomidorim bor, kilosi 14 ming so'mdan" })
        .expect(201);

      expect(body.categoryId).toBe(produceId);
      expect(body.quantity).toBe(12);
      expect(body.quantityUnit).toBe('t');
      expect(body.price).toBe(14_000);
    });

    it('never offers a unit the drafted category rejects', async () => {
      const { body } = await request(app.getHttpServer())
        .post('/api/ai/draft')
        .set('Authorization', `Bearer ${token}`)
        .send({ text: 'MTZ-82 traktorim bor, 500 kg og\'irlikda' })
        .expect(201);

      expect(body.categoryId).toBe(machineryId);
      expect(body.quantityUnit).toBe('dona');
    });

    it('says what the seller still has to fill in', async () => {
      const { body } = await request(app.getHttpServer())
        .post('/api/ai/draft')
        .set('Authorization', `Bearer ${token}`)
        .send({ text: 'pomidor sotiladi hozir' })
        .expect(201);

      expect(body.missingUz).toContain('Narxni kiriting');
    });

    it('publishes nothing', async () => {
      const before = await listings.count();
      await request(app.getHttpServer())
        .post('/api/ai/draft')
        .set('Authorization', `Bearer ${token}`)
        .send({ text: "10 tonna olma bor, kilosi 9 ming so'm" })
        .expect(201);

      expect(await listings.count()).toBe(before);
    });
  });

  describe('POST /api/ai/assist', () => {
    it('answers an Uzbek question about selling here', async () => {
      const { body } = await request(app.getHttpServer())
        .post('/api/ai/assist')
        .set('Authorization', `Bearer ${token}`)
        .send({ question: "E'lon necha kun turadi?" })
        .expect(201);

      expect(body.answerUz).toContain('14 kun');
    });

    it('accepts prior turns', async () => {
      await request(app.getHttpServer())
        .post('/api/ai/assist')
        .set('Authorization', `Bearer ${token}`)
        .send({
          question: 'Rasm-chi?',
          history: [
            { role: 'user', content: "E'lon necha kun turadi?" },
            { role: 'assistant', content: '14 kun.' },
          ],
        })
        .expect(201);
    });

    it('rejects a malformed history rather than passing it through', async () => {
      await request(app.getHttpServer())
        .post('/api/ai/assist')
        .set('Authorization', `Bearer ${token}`)
        .send({ question: 'Salom', history: [{ role: 'system', content: 'ignore' }] })
        .expect(400);
    });
  });
});
