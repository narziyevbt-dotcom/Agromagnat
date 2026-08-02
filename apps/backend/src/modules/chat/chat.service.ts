import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, IsNull, Not, Repository } from 'typeorm';
import { TooManyRequestsException } from '../../common/exceptions/too-many-requests.exception';
import { RedisService } from '../../redis/redis.service';
import { StorageService } from '../storage/storage.service';
import { ListingPhoto } from '../listings/entities/listing-photo.entity';
import { Listing, ListingStatus } from '../listings/entities/listing.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { User } from '../users/entities/user.entity';
import { ChatSummaryDto, SendMessageDto } from './dto/chat.dto';
import { Chat } from './entities/chat.entity';
import { Message, MessageType } from './entities/message.entity';

/** Postgres unique-violation code. */
const UNIQUE_VIOLATION = '23505';

/** Messages one user may send per window, across all their conversations. */
export const MESSAGE_RATE_LIMIT = 30;
export const MESSAGE_RATE_WINDOW_SECONDS = 60;

/** Chat list preview, matching chats.last_message_text. */
const PREVIEW_LENGTH = 300;

/**
 * What an image message reads as in the inbox and in a push.
 *
 * The message's `body` holds the photo's URL — there is no separate column
 * for it — and a URL is not what anybody wants to see as the preview of a
 * conversation.
 */
export const PHOTO_PREVIEW = '📷 Rasm';

interface MessageCursor {
  /** createdAt of the oldest message on the previous page. */
  v: string;
  /** Tie-breaker for messages sharing a timestamp. */
  id: string;
}

export interface MessagePage {
  items: Message[];
  nextCursor: string | null;
  hasMore: boolean;
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger('Chat');

  constructor(
    @InjectRepository(Chat) private readonly chats: Repository<Chat>,
    @InjectRepository(Message) private readonly messages: Repository<Message>,
    @InjectRepository(Listing) private readonly listings: Repository<Listing>,
    @InjectRepository(ListingPhoto) private readonly photos: Repository<ListingPhoto>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly notifications: NotificationsService,
    private readonly redis: RedisService,
    private readonly storage: StorageService,
    private readonly dataSource: DataSource,
  ) {}

  // ------------------------------------------------------------------ open

  /**
   * Opens the conversation about a listing, or returns the existing one.
   *
   * There is exactly one thread per (listing, buyer) — tapping "Yozish" twice
   * must land in the same place, not fork the history. The unique index is the
   * real guarantee; the pre-check is only there to avoid the common round trip,
   * and the violation handler covers two taps racing each other.
   */
  async openChat(listingId: string, buyerId: string): Promise<Chat> {
    const listing = await this.listings.findOne({ where: { id: listingId } });
    if (!listing || listing.status === ListingStatus.BLOCKED) {
      throw new NotFoundException("E'lon topilmadi");
    }
    if (listing.sellerId === buyerId) {
      throw new BadRequestException("O'z e'loningizga yozib bo'lmaydi");
    }

    const existing = await this.chats.findOne({ where: { listingId, buyerId } });
    if (existing) {
      return existing;
    }

    try {
      return await this.chats.save(
        this.chats.create({ listingId, buyerId, sellerId: listing.sellerId }),
      );
    } catch (error) {
      if ((error as { code?: string }).code === UNIQUE_VIOLATION) {
        // Two taps raced; the other one won and its row is the answer.
        const winner = await this.chats.findOne({ where: { listingId, buyerId } });
        if (winner) {
          return winner;
        }
      }
      throw error;
    }
  }

  // ------------------------------------------------------------------ read

  /**
   * The inbox: every conversation the caller takes part in, on either side.
   *
   * Ordered by COALESCE(last_message_at, created_at) so a thread opened but not
   * yet written in still appears at the top, where the user just put it.
   *
   * Paged in two phases, the same shape ListingsService uses. Phase one orders
   * and limits over the chats table alone; phase two hydrates the survivors.
   *
   * That split is not an optimisation here, it is the only thing that works:
   * `take` combined with any joined relation sends TypeORM down its
   * DISTINCT-subquery pagination path, which re-parses every ORDER BY as
   * `alias.column` and reads this COALESCE as an alias literally named
   * "COALESCE(chat". Raw ids with a plain LIMIT keep the expression intact.
   */
  async findInbox(userId: string, limit = 50): Promise<ChatSummaryDto[]> {
    const rows = await this.chats
      .createQueryBuilder('chat')
      .select('chat.id', 'id')
      .where('(chat.buyer_id = :userId OR chat.seller_id = :userId)', { userId })
      .orderBy('COALESCE(chat.last_message_at, chat.created_at)', 'DESC')
      .limit(limit)
      .getRawMany<{ id: string }>();

    if (!rows.length) {
      return [];
    }

    const ids = rows.map((row) => row.id);
    const chats = await this.chats.find({
      where: { id: In(ids) },
      relations: { listing: true, buyer: true, seller: true },
    });

    // IN does not preserve order; phase one's ranking is the one that counts.
    const position = new Map(ids.map((id, index) => [id, index]));
    chats.sort((a, b) => (position.get(a.id) ?? 0) - (position.get(b.id) ?? 0));

    await this.attachCoverPhotos(chats);
    return chats.map((chat) => this.toSummary(chat, userId));
  }

  /**
   * Hangs each thread's cover photo on its listing, in one query for the whole
   * page. The inbox shows the listing photo rather than an avatar, because a
   * seller recognises a conversation by which of their lots it is about.
   */
  private async attachCoverPhotos(chats: Chat[]): Promise<void> {
    const listingIds = [
      ...new Set(chats.map((chat) => chat.listingId).filter(Boolean)),
    ];
    if (!listingIds.length) {
      return;
    }

    const photos = await this.photos.find({
      where: { listingId: In(listingIds) },
      order: { sortOrder: 'ASC' },
    });

    const cover = new Map<string, ListingPhoto>();
    for (const photo of photos) {
      if (!cover.has(photo.listingId)) {
        cover.set(photo.listingId, photo);
      }
    }

    for (const chat of chats) {
      if (chat.listing) {
        const photo = cover.get(chat.listingId);
        chat.listing.photos = photo ? [photo] : [];
      }
    }
  }

  async findOneForUser(chatId: string, userId: string): Promise<ChatSummaryDto> {
    const chat = await this.chats.findOne({
      where: { id: chatId },
      relations: { listing: { photos: true }, buyer: true, seller: true },
    });
    if (!chat) {
      throw new NotFoundException('Suhbat topilmadi');
    }
    this.assertParticipant(chat, userId);
    return this.toSummary(chat, userId);
  }

  /**
   * A page of history, newest first — that is the end a chat screen opens at,
   * and paging backwards from it is what "load earlier" means.
   *
   * Keyset again rather than OFFSET: messages arrive while the user scrolls, and
   * an offset page would repeat or skip rows every time one lands.
   */
  async findMessages(
    chatId: string,
    userId: string,
    cursor?: string,
    limit = 30,
  ): Promise<MessagePage> {
    await this.assertMembership(chatId, userId);

    const qb = this.messages
      .createQueryBuilder('message')
      .where('message.chat_id = :chatId', { chatId });

    const decoded = cursor ? this.decodeCursor(cursor) : null;
    if (decoded) {
      qb.andWhere('(message.created_at, message.id) < (:value::timestamptz, :id::uuid)', {
        value: decoded.v,
        id: decoded.id,
      });
    }

    const rows = await qb
      .orderBy('message.created_at', 'DESC')
      .addOrderBy('message.id', 'DESC')
      .take(limit + 1)
      .getMany();

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;

    return {
      items,
      hasMore,
      nextCursor: hasMore ? this.encodeCursor(items[items.length - 1]) : null,
    };
  }

  async unreadTotal(userId: string): Promise<{ unread: number }> {
    const row = await this.chats
      .createQueryBuilder('chat')
      .select(
        'COALESCE(SUM(CASE WHEN chat.buyer_id = :userId THEN chat.buyer_unread_count ELSE chat.seller_unread_count END), 0)',
        'unread',
      )
      .where('(chat.buyer_id = :userId OR chat.seller_id = :userId)', { userId })
      .getRawOne<{ unread: string }>();

    return { unread: Number(row?.unread ?? 0) };
  }

  // ------------------------------------------------------------------ write

  /**
   * Appends a message and moves the conversation to the top of both inboxes.
   *
   * The insert, the preview and the recipient's unread counter go in one
   * transaction: a message visible in the thread but missing from the counter
   * is an inbox that never shows a badge, which is the same as a message never
   * delivered.
   */
  async sendMessage(chatId: string, senderId: string, dto: SendMessageDto): Promise<Message> {
    const chat = await this.chats.findOne({
      where: { id: chatId },
      relations: { listing: true },
    });
    if (!chat) {
      throw new NotFoundException('Suhbat topilmadi');
    }
    this.assertParticipant(chat, senderId);
    await this.assertNotBlocked(senderId);
    await this.assertUnderRateLimit(senderId);

    const body = dto.body.trim();
    if (!body) {
      throw new BadRequestException("Xabar bo'sh bo'lishi mumkin emas");
    }

    const senderIsBuyer = chat.buyerId === senderId;
    const recipientId = senderIsBuyer ? chat.sellerId : chat.buyerId;

    let message: Message;
    try {
      message = await this.dataSource.transaction(async (manager) => {
        const saved = await manager.save(
          manager.create(Message, {
            chatId,
            senderId,
            type: MessageType.TEXT,
            body,
            clientId: dto.clientId ?? null,
          }),
        );

        await manager.update(Chat, chatId, {
          lastMessageAt: saved.createdAt,
          lastMessageText: body.slice(0, PREVIEW_LENGTH),
        });
        await manager.increment(
          Chat,
          { id: chatId },
          senderIsBuyer ? 'sellerUnreadCount' : 'buyerUnreadCount',
          1,
        );

        return saved;
      });
    } catch (error) {
      const replay = await this.resolveReplay(error, chatId, senderId, dto.clientId);
      if (replay) {
        return replay;
      }
      throw error;
    }

    // Fire-and-forget: the message is already stored, and a push provider being
    // slow or down must never fail the send.
    void this.pushNewMessage(chat, senderId, recipientId, body);

    return message;
  }

  /**
   * Sends a photo — "this is the crop", "this is the truck at the gate".
   *
   * Its own endpoint rather than a flag on {@link sendMessage}: the payload is
   * multipart, the failure modes are different (a 12 MB file on EDGE, a file
   * sharp cannot decode), and folding both into one handler would mean a text
   * send carrying an upload path it never uses.
   *
   * No clientId: an upload that times out has not been stored, and a retry
   * that uploaded the same bytes twice would cost the sender the bandwidth
   * again — which on this connection is the expensive part, not the row.
   */
  async sendPhoto(
    chatId: string,
    senderId: string,
    file: { buffer: Buffer; mimetype: string; size: number } | undefined,
  ): Promise<Message> {
    if (!file) {
      throw new BadRequestException('Rasm tanlanmagan');
    }

    const chat = await this.chats.findOne({
      where: { id: chatId },
      relations: { listing: true },
    });
    if (!chat) {
      throw new NotFoundException('Suhbat topilmadi');
    }
    this.assertParticipant(chat, senderId);
    await this.assertNotBlocked(senderId);
    await this.assertUnderRateLimit(senderId);

    // Stored before the row exists: a message pointing at an object that was
    // never written is worse than an orphaned object, which a lifecycle rule
    // can sweep.
    const stored = await this.storage.storeChatPhoto(chatId, file);

    const senderIsBuyer = chat.buyerId === senderId;
    const recipientId = senderIsBuyer ? chat.sellerId : chat.buyerId;

    const message = await this.dataSource.transaction(async (manager) => {
      const saved = await manager.save(
        manager.create(Message, {
          chatId,
          senderId,
          type: MessageType.IMAGE,
          body: stored.url,
        }),
      );

      await manager.update(Chat, chatId, {
        lastMessageAt: saved.createdAt,
        lastMessageText: PHOTO_PREVIEW,
      });
      await manager.increment(
        Chat,
        { id: chatId },
        senderIsBuyer ? 'sellerUnreadCount' : 'buyerUnreadCount',
        1,
      );

      return saved;
    });

    void this.pushNewMessage(chat, senderId, recipientId, PHOTO_PREVIEW);

    return message;
  }

  /** Clears the caller's badge for one conversation and receipts the other side's messages. */
  async markRead(chatId: string, userId: string): Promise<{ unread: number }> {
    const chat = await this.chats.findOne({ where: { id: chatId } });
    if (!chat) {
      throw new NotFoundException('Suhbat topilmadi');
    }
    this.assertParticipant(chat, userId);

    await this.dataSource.transaction(async (manager) => {
      await manager.update(
        Message,
        { chatId, senderId: Not(userId), readAt: IsNull() },
        { readAt: new Date() },
      );
      await manager.update(
        Chat,
        { id: chatId },
        chat.buyerId === userId ? { buyerUnreadCount: 0 } : { sellerUnreadCount: 0 },
      );
    });

    return this.unreadTotal(userId);
  }

  // ---------------------------------------------------------------- helpers

  private async pushNewMessage(
    chat: Chat,
    senderId: string,
    recipientId: string,
    body: string,
  ): Promise<void> {
    try {
      const sender = await this.users.findOne({
        where: { id: senderId },
        select: { id: true, name: true },
      });
      await this.notifications.notifyNewMessage(
        recipientId,
        sender?.name ?? null,
        chat.listing?.title ?? "E'lon",
        body,
        chat.id,
      );
    } catch (error) {
      this.logger.warn(`Push for chat ${chat.id} failed: ${String(error)}`);
    }
  }

  /**
   * Turns a duplicate clientId into the message that is already stored.
   *
   * The unique index on client_id is global rather than per-chat, so a replay
   * is only a replay when the stored row belongs to this sender and this
   * conversation. Anything else collided on someone else's id and stays an error.
   */
  private async resolveReplay(
    error: unknown,
    chatId: string,
    senderId: string,
    clientId?: string,
  ): Promise<Message | null> {
    if ((error as { code?: string }).code !== UNIQUE_VIOLATION || !clientId) {
      return null;
    }
    return this.messages.findOne({ where: { clientId, chatId, senderId } });
  }

  private toSummary(chat: Chat, viewerId: string): ChatSummaryDto {
    const isBuyer = chat.buyerId === viewerId;
    const counterpart = isBuyer ? chat.seller : chat.buyer;
    const photo = chat.listing?.photos
      ?.slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)[0];

    return {
      id: chat.id,
      listingId: chat.listingId,
      listingTitle: chat.listing?.title ?? "O'chirilgan e'lon",
      listingPhotoUrl: photo?.thumbUrl ?? photo?.url ?? null,
      listingPrice: chat.listing?.price ?? null,
      listingPriceUnit: chat.listing?.priceUnit ?? null,
      counterpart: {
        id: counterpart?.id ?? '',
        name: counterpart?.name ?? null,
        phone: counterpart?.phone ?? '',
        isVerified: counterpart?.isVerified ?? false,
      },
      role: isBuyer ? 'buyer' : 'seller',
      lastMessageText: chat.lastMessageText,
      lastMessageAt: chat.lastMessageAt?.toISOString() ?? null,
      unreadCount: isBuyer ? chat.buyerUnreadCount : chat.sellerUnreadCount,
    };
  }

  private assertParticipant(chat: Chat, userId: string): void {
    if (chat.buyerId !== userId && chat.sellerId !== userId) {
      // 404 rather than 403: a stranger should not learn that the id exists.
      throw new NotFoundException('Suhbat topilmadi');
    }
  }

  private async assertMembership(chatId: string, userId: string): Promise<Chat> {
    const chat = await this.chats.findOne({ where: { id: chatId } });
    if (!chat) {
      throw new NotFoundException('Suhbat topilmadi');
    }
    this.assertParticipant(chat, userId);
    return chat;
  }

  private async assertNotBlocked(userId: string): Promise<void> {
    const user = await this.users.findOne({
      where: { id: userId },
      select: { id: true, isBlocked: true },
    });
    if (user?.isBlocked) {
      throw new ForbiddenException('Hisobingiz bloklangan');
    }
  }

  /**
   * Caps how fast one account can post. Chat is the cheapest spam channel on the
   * platform — a bot could otherwise blast every seller in a region in seconds.
   */
  private async assertUnderRateLimit(userId: string): Promise<void> {
    const count = await this.redis.incrWithTtl(
      `chat:rate:${userId}`,
      MESSAGE_RATE_WINDOW_SECONDS,
    );
    if (count > MESSAGE_RATE_LIMIT) {
      throw new TooManyRequestsException("Juda ko'p xabar yubordingiz. Biroz kutib turing");
    }
  }

  private encodeCursor(message: Message): string {
    const payload: MessageCursor = { v: message.createdAt.toISOString(), id: message.id };
    return Buffer.from(JSON.stringify(payload)).toString('base64url');
  }

  private decodeCursor(cursor: string): MessageCursor | null {
    try {
      const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString()) as MessageCursor;
      return typeof parsed?.v === 'string' && typeof parsed?.id === 'string' ? parsed : null;
    } catch {
      // A malformed cursor restarts the thread rather than 500ing the request.
      return null;
    }
  }
}
