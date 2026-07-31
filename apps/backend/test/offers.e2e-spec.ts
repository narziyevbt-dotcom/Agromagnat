import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { Category } from '../src/modules/catalog/entities/category.entity';
import { Offer, OfferStatus } from '../src/modules/chat/entities/offer.entity';
import { District } from '../src/modules/geo/entities/district.entity';
import { Region } from '../src/modules/geo/entities/region.entity';
import { Listing, ListingStatus } from '../src/modules/listings/entities/listing.entity';
import { User } from '../src/modules/users/entities/user.entity';
import { RedisService } from '../src/redis/redis.service';

/**
 * Offers, and the sale accepting one closes.
 *
 * The value of this suite is in the transitions rather than the happy path:
 * accepting has to move four tables together, rival offers have to lose, and
 * neither side may answer their own offer. All of that is only observable
 * against a real database.
 */
describe('Offers (e2e)', () => {
  let app: INestApplication;
  let listings: Repository<Listing>;
  let offers: Repository<Offer>;
  let users: Repository<User>;
  let redis: RedisService;

  const sellerPhone = `+99897${Math.floor(1_000_000 + Math.random() * 8_999_999)}`;
  const buyerPhone = `+99898${Math.floor(1_000_000 + Math.random() * 8_999_999)}`;
  const rivalPhone = `+99899${Math.floor(1_000_000 + Math.random() * 8_999_999)}`;

  let sellerToken: string;
  let buyerToken: string;
  let rivalToken: string;
  let sellerId: string;
  let categoryId: string;
  let regionId: string;
  let districtId: string;
  const createdListings: string[] = [];

  const login = async (phone: string): Promise<string> => {
    await redis.del(`otp:rate:${phone}`);
    await request(app.getHttpServer()).post('/api/auth/request-otp').send({ phone });
    const response = await request(app.getHttpServer())
      .post('/api/auth/verify-otp')
      .send({ phone, code: '000000', name: 'Test' });
    return response.body.accessToken;
  };

  /** A fresh listing plus an open conversation, so cases never share state. */
  const newListingWithChat = async (
    price = 14_000,
  ): Promise<{ listingId: string; chatId: string; rivalChatId: string }> => {
    const listing = await request(app.getHttpServer())
      .post('/api/listings')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({
        title: `Kelishuv testi ${Math.random().toString(36).slice(2, 8)}`,
        categoryId,
        quantity: 12,
        quantityUnit: 't',
        price,
        priceUnit: 'kg',
        regionId,
        districtId,
      })
      .expect(201);
    createdListings.push(listing.body.id);

    const chat = await request(app.getHttpServer())
      .post(`/api/listings/${listing.body.id}/chat`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .expect(200);

    const rivalChat = await request(app.getHttpServer())
      .post(`/api/listings/${listing.body.id}/chat`)
      .set('Authorization', `Bearer ${rivalToken}`)
      .expect(200);

    return {
      listingId: listing.body.id,
      chatId: chat.body.id,
      rivalChatId: rivalChat.body.id,
    };
  };

  const offer = (chatId: string, token: string, body: Record<string, unknown>) =>
    request(app.getHttpServer())
      .post(`/api/chats/${chatId}/offers`)
      .set('Authorization', `Bearer ${token}`)
      .send(body);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api', { exclude: ['health'] });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();

    listings = moduleRef.get(getRepositoryToken(Listing));
    offers = moduleRef.get(getRepositoryToken(Offer));
    users = moduleRef.get(getRepositoryToken(User));
    redis = moduleRef.get(RedisService);

    const categories: Repository<Category> = moduleRef.get(getRepositoryToken(Category));
    const regions: Repository<Region> = moduleRef.get(getRepositoryToken(Region));
    const districts: Repository<District> = moduleRef.get(getRepositoryToken(District));

    categoryId = (await categories.findOneOrFail({ where: { slug: 'sabzavotlar' } })).id;
    regionId = (await regions.findOneOrFail({ where: { slug: 'samarqand' } })).id;
    districtId = (await districts.findOneOrFail({ where: { regionId, slug: 'urgut' } })).id;

    sellerToken = await login(sellerPhone);
    buyerToken = await login(buyerPhone);
    rivalToken = await login(rivalPhone);
    sellerId = (await users.findOneOrFail({ where: { phone: sellerPhone } })).id;
  });

  beforeEach(async () => {
    // See the note in listings.e2e-spec.ts: this suite writes far past what a
    // real account would in an hour.
    await redis.delByPattern('rate:*');
    // The hourly offer cap would otherwise fail later cases in the suite.
    await redis.delByPattern('offer:rate:*');
  });

  afterAll(async () => {
    if (createdListings.length) await listings.delete(createdListings);
    await users.delete({ phone: sellerPhone });
    await users.delete({ phone: buyerPhone });
    await users.delete({ phone: rivalPhone });
    await redis.delByPattern('offer:rate:*');
    await redis.delByPattern('feed:v1:*');
    await redis.delByPattern('price:suggest:*');
    await app.close();
  });

  describe('POST /api/chats/:id/offers', () => {
    it('requires authentication', async () => {
      const { chatId } = await newListingWithChat();
      await request(app.getHttpServer())
        .post(`/api/chats/${chatId}/offers`)
        .send({ amount: 12_000 })
        .expect(401);
    });

    it('refuses a stranger to the conversation', async () => {
      const { chatId } = await newListingWithChat();
      await offer(chatId, rivalToken, { amount: 12_000 }).expect(403);
    });

    it('records a buyer offer and defaults the unit to the listing', async () => {
      const { chatId } = await newListingWithChat();
      const { body } = await offer(chatId, buyerToken, { amount: 12_000 }).expect(201);

      expect(body).toMatchObject({
        fromRole: 'buyer',
        amount: '12000.00',
        priceUnit: 'kg',
        status: 'pending',
        isMine: true,
        canRespond: false,
      });
    });

    it('shows as answerable to the counterpart, not to its author', async () => {
      const { chatId } = await newListingWithChat();
      await offer(chatId, buyerToken, { amount: 12_000 }).expect(201);

      const mine = await request(app.getHttpServer())
        .get(`/api/chats/${chatId}/offers`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(200);
      const theirs = await request(app.getHttpServer())
        .get(`/api/chats/${chatId}/offers`)
        .set('Authorization', `Bearer ${sellerToken}`)
        .expect(200);

      expect(mine.body[0].canRespond).toBe(false);
      expect(theirs.body[0].canRespond).toBe(true);
    });

    it('lands in the conversation as an offer message', async () => {
      const { chatId } = await newListingWithChat();
      const created = await offer(chatId, buyerToken, { amount: 12_000 }).expect(201);

      const { body } = await request(app.getHttpServer())
        .get(`/api/chats/${chatId}/messages`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(200);

      const message = body.items.find((m: { type: string }) => m.type === 'offer');
      expect(message).toBeDefined();
      // The card is joined to its row without a request per message.
      expect(message.body.startsWith(created.body.id)).toBe(true);
    });

    it('allows only one live offer per side', async () => {
      // Two open offers would let the counterpart accept either, making the
      // winning price a race rather than a decision.
      const { chatId } = await newListingWithChat();
      await offer(chatId, buyerToken, { amount: 12_000 }).expect(201);
      const second = await offer(chatId, buyerToken, { amount: 13_000 }).expect(400);
      expect(second.body.message).toContain('javob kutayotgan taklif');
    });

    it('lets both sides have one open offer at the same time', async () => {
      const { chatId } = await newListingWithChat();
      await offer(chatId, buyerToken, { amount: 12_000 }).expect(201);
      await offer(chatId, sellerToken, { amount: 13_500 }).expect(201);
    });

    it('rejects a price that is missing a zero', async () => {
      const { chatId } = await newListingWithChat(14_000);
      const { body } = await offer(chatId, buyerToken, { amount: 140 }).expect(400);
      expect(body.message).toContain('juda past');
    });

    it('validates the amount', async () => {
      const { chatId } = await newListingWithChat();
      await offer(chatId, buyerToken, { amount: -5 }).expect(400);
      await offer(chatId, buyerToken, {}).expect(400);
    });
  });

  describe('POST /api/offers/:id/accept', () => {
    it('closes the sale at the agreed price, not the asking price', async () => {
      const { listingId, chatId } = await newListingWithChat(14_000);
      const created = await offer(chatId, buyerToken, { amount: 12_000 }).expect(201);

      await request(app.getHttpServer())
        .post(`/api/offers/${created.body.id}/accept`)
        .set('Authorization', `Bearer ${sellerToken}`)
        .expect(201);

      const listing = await listings.findOneOrFail({ where: { id: listingId } });
      expect(listing.status).toBe(ListingStatus.SOLD);
      expect(listing.soldAt).not.toBeNull();
      // The asking price is preserved; the agreed price is recorded beside it.
      expect(listing.price).toBe('14000.00');
      expect(listing.soldPrice).toBe('12000.00');
    });

    it("increments the seller's sales count", async () => {
      const before = (await users.findOneOrFail({ where: { id: sellerId } })).salesCount;

      const { chatId } = await newListingWithChat();
      const created = await offer(chatId, buyerToken, { amount: 12_000 }).expect(201);
      await request(app.getHttpServer())
        .post(`/api/offers/${created.body.id}/accept`)
        .set('Authorization', `Bearer ${sellerToken}`)
        .expect(201);

      const after = (await users.findOneOrFail({ where: { id: sellerId } })).salesCount;
      expect(after).toBe(before + 1);
    });

    it('expires every rival offer on the same listing', async () => {
      // Two buyers negotiating; one wins. Leaving the loser pending would let a
      // second acceptance land on a listing that is already sold.
      const { chatId, rivalChatId } = await newListingWithChat();
      const mine = await offer(chatId, buyerToken, { amount: 12_000 }).expect(201);
      const rival = await offer(rivalChatId, rivalToken, { amount: 11_000 }).expect(201);

      await request(app.getHttpServer())
        .post(`/api/offers/${mine.body.id}/accept`)
        .set('Authorization', `Bearer ${sellerToken}`)
        .expect(201);

      const loser = await offers.findOneOrFail({ where: { id: rival.body.id } });
      expect(loser.status).toBe(OfferStatus.EXPIRED);
    });

    it('cannot be accepted twice', async () => {
      const { chatId } = await newListingWithChat();
      const created = await offer(chatId, buyerToken, { amount: 12_000 }).expect(201);

      await request(app.getHttpServer())
        .post(`/api/offers/${created.body.id}/accept`)
        .set('Authorization', `Bearer ${sellerToken}`)
        .expect(201);
      await request(app.getHttpServer())
        .post(`/api/offers/${created.body.id}/accept`)
        .set('Authorization', `Bearer ${sellerToken}`)
        .expect(400);
    });

    it('refuses to let anyone accept their own offer', async () => {
      // Otherwise a seller could accept their own asking price and close the
      // sale unilaterally, inflating both sales count and the price index.
      const { chatId } = await newListingWithChat();
      const created = await offer(chatId, buyerToken, { amount: 12_000 }).expect(201);

      await request(app.getHttpServer())
        .post(`/api/offers/${created.body.id}/accept`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(403);
    });

    it('refuses an outsider', async () => {
      const { chatId } = await newListingWithChat();
      const created = await offer(chatId, buyerToken, { amount: 12_000 }).expect(201);

      await request(app.getHttpServer())
        .post(`/api/offers/${created.body.id}/accept`)
        .set('Authorization', `Bearer ${rivalToken}`)
        .expect(403);
    });

    it('blocks a new offer once the listing is sold', async () => {
      const { chatId, rivalChatId } = await newListingWithChat();
      const created = await offer(chatId, buyerToken, { amount: 12_000 }).expect(201);
      await request(app.getHttpServer())
        .post(`/api/offers/${created.body.id}/accept`)
        .set('Authorization', `Bearer ${sellerToken}`)
        .expect(201);

      const late = await offer(rivalChatId, rivalToken, { amount: 13_000 }).expect(400);
      expect(late.body.message).toContain('sotilgan');
    });

    it('opens the review gate that was previously locked behind a manual button', async () => {
      // The whole point: sale → review → rating → trust, without asking the
      // seller to remove their own listing from the feed by hand.
      const { listingId, chatId } = await newListingWithChat();
      const created = await offer(chatId, buyerToken, { amount: 12_000 }).expect(201);
      await request(app.getHttpServer())
        .post(`/api/offers/${created.body.id}/accept`)
        .set('Authorization', `Bearer ${sellerToken}`)
        .expect(201);

      await request(app.getHttpServer())
        .post(`/api/listings/${listingId}/review`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .send({ rating: 5, comment: 'Kelishuv yaxshi bo‘ldi' })
        .expect(201);
    });
  });

  describe('POST /api/offers/:id/decline', () => {
    it('declines without touching the listing', async () => {
      const { listingId, chatId } = await newListingWithChat();
      const created = await offer(chatId, buyerToken, { amount: 12_000 }).expect(201);

      const { body } = await request(app.getHttpServer())
        .post(`/api/offers/${created.body.id}/decline`)
        .set('Authorization', `Bearer ${sellerToken}`)
        .expect(201);

      expect(body.status).toBe('declined');
      const listing = await listings.findOneOrFail({ where: { id: listingId } });
      expect(listing.status).toBe(ListingStatus.ACTIVE);
      expect(listing.soldPrice).toBeNull();
    });

    it('frees the side to make a new offer', async () => {
      const { chatId } = await newListingWithChat();
      const first = await offer(chatId, buyerToken, { amount: 12_000 }).expect(201);
      await request(app.getHttpServer())
        .post(`/api/offers/${first.body.id}/decline`)
        .set('Authorization', `Bearer ${sellerToken}`)
        .expect(201);

      await offer(chatId, buyerToken, { amount: 12_500 }).expect(201);
    });
  });

  describe('POST /api/offers/:id/withdraw', () => {
    it('lets the author retract their own pending offer', async () => {
      const { chatId } = await newListingWithChat();
      const created = await offer(chatId, buyerToken, { amount: 12_000 }).expect(201);

      const { body } = await request(app.getHttpServer())
        .post(`/api/offers/${created.body.id}/withdraw`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .expect(201);
      expect(body.status).toBe('declined');
    });

    it('refuses to let the counterpart withdraw it', async () => {
      const { chatId } = await newListingWithChat();
      const created = await offer(chatId, buyerToken, { amount: 12_000 }).expect(201);

      await request(app.getHttpServer())
        .post(`/api/offers/${created.body.id}/withdraw`)
        .set('Authorization', `Bearer ${sellerToken}`)
        .expect(403);
    });
  });
});
