// Set before AppModule is imported: the config factory reads process.env once,
// at module load, so overriding ConfigService afterwards is both harder and
// less faithful than simply giving the real one the right environment.
process.env.TELEGRAM_BOT_TOKEN = 'test-bot-token';
process.env.TELEGRAM_BOT_USERNAME = 'agromagnat_test_bot';
process.env.TELEGRAM_WEBHOOK_SECRET = 'test-webhook-secret';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { AuthIdentity } from '../src/modules/auth/entities/auth-identity.entity';
import { TelegramService } from '../src/modules/notifications/telegram/telegram.service';
import { User } from '../src/modules/users/entities/user.entity';
import { RedisService } from '../src/redis/redis.service';

/**
 * Signing in for nothing.
 *
 * The number arrives on Telegram's own contact card, already verified by
 * Telegram, so there is no code to send and no message to pay for. This walks
 * the whole path with Telegram's side simulated: ticket, `/start`, contact,
 * session.
 *
 * The checks that matter are the refusals. A contact that is not the sender's
 * own, a ticket used twice, a session collected twice — each of those is
 * somebody else's account if it is wrong.
 */
describe('Telegram sign-in (e2e)', () => {
  let app: INestApplication;
  let users: Repository<User>;
  let identities: Repository<AuthIdentity>;
  let redis: RedisService;
  let sent: Array<{ chatId: string; text: string }>;

  const SECRET = 'test-webhook-secret';
  const CHAT_ID = 991_000_001;
  const TG_USER_ID = 771_000_001;
  const phone = `+99893${Math.floor(1_000_000 + Math.random() * 8_999_999)}`;

  const webhook = (body: unknown, secret = SECRET) =>
    request(app.getHttpServer())
      .post('/api/telegram/webhook')
      .set('x-telegram-bot-api-secret-token', secret)
      .send(body as object);

  const start = (ticket: string, chatId = CHAT_ID) =>
    webhook({ message: { chat: { id: chatId }, from: { id: TG_USER_ID }, text: `/start ${ticket}` } });

  const shareContact = (
    overrides: Record<string, unknown> = {},
    chatId = CHAT_ID,
  ) =>
    webhook({
      message: {
        chat: { id: chatId },
        from: { id: TG_USER_ID },
        contact: {
          phone_number: phone,
          user_id: TG_USER_ID,
          first_name: 'Anvar',
          ...overrides,
        },
      },
    });

  const newTicket = async (): Promise<string> => {
    const { body } = await request(app.getHttpServer())
      .post('/api/auth/telegram/start')
      .expect(200);
    return body.ticket;
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      // Telegram is the one part that cannot be exercised for real, so it is
      // the one part replaced — everything downstream of it is genuine.
      .overrideProvider(TelegramService)
      .useValue({
        isConfigured: true,
        webhookSecret: SECRET,
        sendMessage: async (chatId: string, text: string) => {
          sent.push({ chatId, text });
        },
      })
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api', { exclude: ['health'] });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();

    users = moduleRef.get(getRepositoryToken(User));
    identities = moduleRef.get(getRepositoryToken(AuthIdentity));
    redis = moduleRef.get(RedisService);
  });

  beforeEach(() => {
    sent = [];
  });

  afterAll(async () => {
    await users.delete({ phone });
    await redis.delByPattern('tglink:*');
    await app.close();
  });

  describe('POST /api/auth/telegram/start', () => {
    it('hands back a deep link the browser can open', async () => {
      const { body } = await request(app.getHttpServer())
        .post('/api/auth/telegram/start')
        .expect(200);

      expect(body.deepLink).toContain('t.me/agromagnat_test_bot?start=');
      expect(body.deepLink).toContain(body.ticket);
      expect(body.expiresIn).toBeGreaterThan(0);
    });

    it('never repeats a ticket', async () => {
      // A guessable ticket is somebody else's session.
      const tickets = new Set(await Promise.all([newTicket(), newTicket(), newTicket()]));

      expect(tickets.size).toBe(3);
    });
  });

  describe('the whole path', () => {
    it('asks for the number, then signs the person in', async () => {
      const ticket = await newTicket();

      // Nothing to collect yet — the person has not answered.
      await request(app.getHttpServer())
        .get(`/api/auth/telegram/session/${ticket}`)
        .expect(204);

      await start(ticket).expect(201);
      expect(sent.at(-1)?.text).toContain('Agromagnat');

      await shareContact().expect(201);
      expect(sent.at(-1)?.text).toContain('Tasdiqlandi');

      const { body } = await request(app.getHttpServer())
        .get(`/api/auth/telegram/session/${ticket}`)
        .expect(200);

      expect(body.accessToken).toEqual(expect.any(String));
      expect(body.isNewUser).toBe(true);

      // The number is verified because Telegram verified it — the gate opens
      // without a single message having been paid for.
      const user = await users.findOneOrFail({ where: { phone } });
      expect(user.phoneVerifiedAt).not.toBeNull();
      expect(user.telegramChatId).toBe(String(CHAT_ID));
      expect(user.name).toBe('Anvar');

      const rows = await identities.find({ where: { userId: user.id } });
      expect(rows.map((row) => row.provider)).toContain('telegram');
    });

    it('recognises the same person on a second sign-in', async () => {
      const ticket = await newTicket();
      await start(ticket);
      await shareContact();

      const { body } = await request(app.getHttpServer())
        .get(`/api/auth/telegram/session/${ticket}`)
        .expect(200);

      // Not a second account on the same number.
      expect(body.isNewUser).toBe(false);
    });
  });

  describe('refusals', () => {
    it('refuses a contact that is not the sender’s own', async () => {
      const ticket = await newTicket();
      await start(ticket);

      // Forwarding a friend's contact card must not sign you in as them.
      await shareContact({ user_id: 999_999_999 }).expect(201);
      expect(sent.at(-1)?.text).toContain('o‘z');

      await request(app.getHttpServer())
        .get(`/api/auth/telegram/session/${ticket}`)
        .expect(204);
    });

    it('refuses a contact card with no Telegram account behind it', async () => {
      const ticket = await newTicket();
      await start(ticket);

      // A manually typed card has no user_id, and proves nothing.
      await shareContact({ user_id: undefined }).expect(201);

      await request(app.getHttpServer())
        .get(`/api/auth/telegram/session/${ticket}`)
        .expect(204);
    });

    it('refuses a foreign number', async () => {
      const ticket = await newTicket();
      await start(ticket);

      await shareContact({ phone_number: '+79001234567' }).expect(201);
      expect(sent.at(-1)?.text).toContain('O‘zbekiston');

      await request(app.getHttpServer())
        .get(`/api/auth/telegram/session/${ticket}`)
        .expect(204);
    });

    it('lets a session be collected only once', async () => {
      const ticket = await newTicket();
      await start(ticket);
      await shareContact();

      await request(app.getHttpServer())
        .get(`/api/auth/telegram/session/${ticket}`)
        .expect(200);

      // A ticket that leaks after the fact has to be worth nothing.
      await request(app.getHttpServer())
        .get(`/api/auth/telegram/session/${ticket}`)
        .expect(204);
    });

    it('ignores a contact for a ticket that was never started', async () => {
      await shareContact({}, 991_000_999).expect(201);
      expect(sent.at(-1)?.text).toContain('eskirgan');
    });

    it('refuses a webhook without the shared secret', async () => {
      // Otherwise anyone who guesses the URL can mint sessions at will.
      await webhook(
        { message: { chat: { id: CHAT_ID }, from: { id: TG_USER_ID }, text: '/start x' } },
        'wrong-secret',
      ).expect(403);
    });

    it('tells somebody who just opened the bot what to do', async () => {
      await webhook({
        message: { chat: { id: CHAT_ID }, from: { id: TG_USER_ID }, text: '/start' },
      }).expect(201);

      expect(sent.at(-1)?.text).toContain('Telegram orqali kirish');
    });
  });
});
