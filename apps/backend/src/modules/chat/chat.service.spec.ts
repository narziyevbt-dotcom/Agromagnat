import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { TooManyRequestsException } from '../../common/exceptions/too-many-requests.exception';
import { RedisService } from '../../redis/redis.service';
import { Listing, ListingStatus } from '../listings/entities/listing.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { User } from '../users/entities/user.entity';
import { ChatService, MESSAGE_RATE_LIMIT } from './chat.service';
import { Chat } from './entities/chat.entity';
import { Message } from './entities/message.entity';

type MockRepo<T extends object> = Partial<Record<keyof Repository<T>, jest.Mock>>;

const createRepo = <T extends object>(): MockRepo<T> => ({
  find: jest.fn(),
  findOne: jest.fn(),
  findOneOrFail: jest.fn(),
  save: jest.fn(),
  create: jest.fn((value) => value as T),
  update: jest.fn(),
  delete: jest.fn(),
  createQueryBuilder: jest.fn(),
});

const SELLER = '11111111-1111-1111-1111-111111111111';
const BUYER = '22222222-2222-2222-2222-222222222222';
const STRANGER = '33333333-3333-3333-3333-333333333333';
const LISTING = '44444444-4444-4444-4444-444444444444';
const CHAT = '55555555-5555-5555-5555-555555555555';

const uniqueViolation = () => Object.assign(new Error('duplicate key'), { code: '23505' });

const aChat = (over: Partial<Chat> = {}): Chat =>
  ({
    id: CHAT,
    listingId: LISTING,
    buyerId: BUYER,
    sellerId: SELLER,
    buyerUnreadCount: 0,
    sellerUnreadCount: 0,
    lastMessageAt: null,
    lastMessageText: null,
    listing: { id: LISTING, title: 'Pomidor 12 t' },
    ...over,
  }) as Chat;

describe('ChatService', () => {
  let service: ChatService;
  let chats: MockRepo<Chat>;
  let messages: MockRepo<Message>;
  let listings: MockRepo<Listing>;
  let users: MockRepo<User>;
  let notifications: { notifyNewMessage: jest.Mock };
  let redis: { incrWithTtl: jest.Mock };
  let manager: {
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
    increment: jest.Mock;
  };

  beforeEach(async () => {
    chats = createRepo<Chat>();
    messages = createRepo<Message>();
    listings = createRepo<Listing>();
    users = createRepo<User>();
    notifications = { notifyNewMessage: jest.fn().mockResolvedValue(undefined) };
    redis = { incrWithTtl: jest.fn().mockResolvedValue(1) };

    manager = {
      create: jest.fn((_entity, value) => value),
      save: jest.fn(async (value) => ({
        id: 'message-1',
        createdAt: new Date('2026-07-31T10:00:00Z'),
        ...value,
      })),
      update: jest.fn(),
      increment: jest.fn(),
    };

    const dataSource = {
      transaction: jest.fn(async (callback: (m: typeof manager) => unknown) =>
        callback(manager),
      ),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ChatService,
        { provide: getRepositoryToken(Chat), useValue: chats },
        { provide: getRepositoryToken(Message), useValue: messages },
        { provide: getRepositoryToken(Listing), useValue: listings },
        { provide: getRepositoryToken(User), useValue: users },
        { provide: NotificationsService, useValue: notifications },
        { provide: RedisService, useValue: redis },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = moduleRef.get(ChatService);
    users.findOne!.mockResolvedValue({ id: BUYER, name: 'Anvar', isBlocked: false });
  });

  describe('openChat', () => {
    it('returns the existing thread instead of forking a second one', async () => {
      listings.findOne!.mockResolvedValue({
        id: LISTING,
        sellerId: SELLER,
        status: ListingStatus.ACTIVE,
      });
      const existing = aChat();
      chats.findOne!.mockResolvedValue(existing);

      await expect(service.openChat(LISTING, BUYER)).resolves.toBe(existing);
      expect(chats.save).not.toHaveBeenCalled();
    });

    it('refuses a seller writing to their own listing', async () => {
      listings.findOne!.mockResolvedValue({
        id: LISTING,
        sellerId: SELLER,
        status: ListingStatus.ACTIVE,
      });

      await expect(service.openChat(LISTING, SELLER)).rejects.toThrow(BadRequestException);
    });

    it('hides a blocked listing behind a 404', async () => {
      listings.findOne!.mockResolvedValue({
        id: LISTING,
        sellerId: SELLER,
        status: ListingStatus.BLOCKED,
      });

      await expect(service.openChat(LISTING, BUYER)).rejects.toThrow(NotFoundException);
    });

    it('resolves the race when two taps insert at once', async () => {
      listings.findOne!.mockResolvedValue({
        id: LISTING,
        sellerId: SELLER,
        status: ListingStatus.ACTIVE,
      });
      const winner = aChat();
      chats.findOne!.mockResolvedValueOnce(null).mockResolvedValueOnce(winner);
      chats.save!.mockRejectedValue(uniqueViolation());

      await expect(service.openChat(LISTING, BUYER)).resolves.toBe(winner);
    });
  });

  describe('sendMessage', () => {
    beforeEach(() => {
      chats.findOne!.mockResolvedValue(aChat());
    });

    it('stores the message and raises the recipient\'s unread counter', async () => {
      const message = await service.sendMessage(CHAT, BUYER, { body: '  Narxi qancha?  ' });

      expect(message.body).toBe('Narxi qancha?');
      expect(manager.increment).toHaveBeenCalledWith(
        Chat,
        { id: CHAT },
        'sellerUnreadCount',
        1,
      );
      expect(manager.update).toHaveBeenCalledWith(
        Chat,
        CHAT,
        expect.objectContaining({ lastMessageText: 'Narxi qancha?' }),
      );
    });

    it('raises the buyer counter when the seller replies', async () => {
      await service.sendMessage(CHAT, SELLER, { body: '14 000' });

      expect(manager.increment).toHaveBeenCalledWith(
        Chat,
        { id: CHAT },
        'buyerUnreadCount',
        1,
      );
    });

    it('notifies the other side, never the sender', async () => {
      await service.sendMessage(CHAT, BUYER, { body: 'Salom' });
      // The push is fire-and-forget, so it lands a tick after the send resolves.
      await Promise.resolve();
      await Promise.resolve();

      expect(notifications.notifyNewMessage).toHaveBeenCalledWith(
        SELLER,
        'Anvar',
        'Pomidor 12 t',
        'Salom',
        CHAT,
      );
    });

    it('hides someone else\'s conversation behind a 404', async () => {
      await expect(
        service.sendMessage(CHAT, STRANGER, { body: 'Salom' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('refuses a blocked account', async () => {
      users.findOne!.mockResolvedValue({ id: BUYER, isBlocked: true });

      await expect(service.sendMessage(CHAT, BUYER, { body: 'Salom' })).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('rate-limits a burst from one account', async () => {
      redis.incrWithTtl.mockResolvedValue(MESSAGE_RATE_LIMIT + 1);

      await expect(service.sendMessage(CHAT, BUYER, { body: 'Salom' })).rejects.toThrow(
        TooManyRequestsException,
      );
    });

    it('returns the stored message when a clientId is replayed', async () => {
      const stored = { id: 'message-1', body: 'Salom' } as Message;
      manager.save.mockRejectedValue(uniqueViolation());
      messages.findOne!.mockResolvedValue(stored);

      await expect(
        service.sendMessage(CHAT, BUYER, { body: 'Salom', clientId: 'client-abc-123' }),
      ).resolves.toBe(stored);
    });

    it('rethrows a collision that is not the caller\'s own message', async () => {
      manager.save.mockRejectedValue(uniqueViolation());
      messages.findOne!.mockResolvedValue(null);

      await expect(
        service.sendMessage(CHAT, BUYER, { body: 'Salom', clientId: 'client-abc-123' }),
      ).rejects.toThrow('duplicate key');
    });
  });

  describe('markRead', () => {
    it('clears only the reader\'s side of the badge', async () => {
      chats.findOne!.mockResolvedValue(aChat({ buyerUnreadCount: 3 }));
      chats.createQueryBuilder!.mockReturnValue(unreadQueryBuilder('0'));

      await service.markRead(CHAT, BUYER);

      expect(manager.update).toHaveBeenCalledWith(
        Chat,
        { id: CHAT },
        { buyerUnreadCount: 0 },
      );
    });
  });

  describe('unreadTotal', () => {
    it('sums the viewer\'s side across every conversation', async () => {
      chats.createQueryBuilder!.mockReturnValue(unreadQueryBuilder('7'));

      await expect(service.unreadTotal(BUYER)).resolves.toEqual({ unread: 7 });
    });

    it('reads zero when the user has no conversations', async () => {
      chats.createQueryBuilder!.mockReturnValue(unreadQueryBuilder(undefined));

      await expect(service.unreadTotal(BUYER)).resolves.toEqual({ unread: 0 });
    });
  });

  describe('findMessages', () => {
    it('pages backwards and hands back a cursor only when more remain', async () => {
      chats.findOne!.mockResolvedValue(aChat());
      const rows = Array.from({ length: 3 }, (_, index) => ({
        id: `message-${index}`,
        createdAt: new Date(`2026-07-31T10:0${index}:00Z`),
      })) as Message[];
      messages.createQueryBuilder!.mockReturnValue(messageQueryBuilder(rows));

      const page = await service.findMessages(CHAT, BUYER, undefined, 2);

      expect(page.items).toHaveLength(2);
      expect(page.hasMore).toBe(true);
      expect(page.nextCursor).toBeTruthy();

      // The cursor has to survive the round trip, or "load earlier" repeats a page.
      const decoded = JSON.parse(
        Buffer.from(page.nextCursor as string, 'base64url').toString(),
      );
      expect(decoded.id).toBe('message-1');
    });

    it('refuses history to a non-participant', async () => {
      chats.findOne!.mockResolvedValue(aChat());

      await expect(service.findMessages(CHAT, STRANGER)).rejects.toThrow(NotFoundException);
    });
  });
});

/** Minimal chainable stub for the SUM(...) unread query. */
const unreadQueryBuilder = (unread: string | undefined) => ({
  select: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  getRawOne: jest.fn().mockResolvedValue(unread === undefined ? undefined : { unread }),
});

/** Minimal chainable stub for the message history query. */
const messageQueryBuilder = (rows: Message[]) => ({
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  addOrderBy: jest.fn().mockReturnThis(),
  take: jest.fn().mockReturnThis(),
  getMany: jest.fn().mockResolvedValue(rows),
});
