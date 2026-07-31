import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Not, Repository } from 'typeorm';
import { TooManyRequestsException } from '../../common/exceptions/too-many-requests.exception';
import { RedisService } from '../../redis/redis.service';
import { Listing, ListingStatus } from '../listings/entities/listing.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { User } from '../users/entities/user.entity';
import { CreateOfferDto, OfferDto } from './dto/offer.dto';
import { Chat } from './entities/chat.entity';
import { Message, MessageType } from './entities/message.entity';
import { Offer, OfferRole, OfferStatus } from './entities/offer.entity';

/** Postgres unique-violation code. */
const UNIQUE_VIOLATION = '23505';

/** Offers one user may make per window, across every conversation. */
export const OFFER_RATE_LIMIT = 20;
export const OFFER_RATE_WINDOW_SECONDS = 3600;

/**
 * An offer below this fraction of the asking price is almost always a typo —
 * a missing zero — rather than a negotiating position.
 */
const MIN_PLAUSIBLE_RATIO = 0.05;

const PREVIEW_LENGTH = 300;

/**
 * Price negotiation, and the sale it closes.
 *
 * Kept apart from `ChatService` because the two do different jobs: that one
 * moves text between two people, this one changes the state of a listing, a
 * seller's sales count and the price index. Mixing them would put a
 * multi-table transaction inside the hot path of sending a message.
 */
@Injectable()
export class OffersService {
  private readonly logger = new Logger('Offers');

  constructor(
    @InjectRepository(Offer) private readonly offers: Repository<Offer>,
    @InjectRepository(Chat) private readonly chats: Repository<Chat>,
    private readonly redis: RedisService,
    private readonly notifications: NotificationsService,
    private readonly dataSource: DataSource,
  ) {}

  // --------------------------------------------------------------- create

  async create(chatId: string, senderId: string, dto: CreateOfferDto): Promise<OfferDto> {
    const chat = await this.loadChat(chatId, senderId);
    const listing = chat.listing;

    if (listing.status === ListingStatus.SOLD) {
      throw new BadRequestException("Bu e'lon allaqachon sotilgan");
    }
    if (listing.status === ListingStatus.BLOCKED) {
      throw new BadRequestException("Bu e'lon bloklangan");
    }

    await this.assertUnderRateLimit(senderId);

    const priceUnit = dto.priceUnit ?? listing.priceUnit;

    // Only comparable prices can be compared, so the sanity check below is
    // skipped when the offer is quoted in a different unit from the listing.
    if (priceUnit === listing.priceUnit) {
      const asking = Number(listing.price);
      if (asking > 0 && dto.amount < asking * MIN_PLAUSIBLE_RATIO) {
        throw new BadRequestException(
          "Taklif narxi juda past — nol tushib qolmaganini tekshiring",
        );
      }
    }

    const fromRole = chat.buyerId === senderId ? OfferRole.BUYER : OfferRole.SELLER;

    let offer: Offer;
    try {
      offer = await this.offers.save(
        this.offers.create({
          chatId,
          listingId: listing.id,
          senderId,
          fromRole,
          amount: dto.amount.toFixed(2),
          priceUnit,
          quantity: dto.quantity === undefined ? null : String(dto.quantity),
          quantityUnit: dto.quantityUnit ?? (dto.quantity ? listing.quantityUnit : null),
          note: dto.note ?? null,
        }),
      );
    } catch (error) {
      // The partial unique index allows one pending offer per side. Hitting it
      // means a double tap or a stale screen, and the right answer is to say
      // so rather than to silently replace a price the other side may be
      // looking at right now.
      if ((error as { code?: string }).code === UNIQUE_VIOLATION) {
        throw new BadRequestException(
          "Sizda javob kutayotgan taklif bor — avval uni bekor qiling",
        );
      }
      throw error;
    }

    await this.postToThread(chat, senderId, offer, this.offerPreview(offer));
    return this.toDto(offer, senderId, chat);
  }

  // -------------------------------------------------------------- respond

  /**
   * Accepting is the only place a sale is recorded, and it does four things
   * that have to happen together or not at all: the offer is marked accepted,
   * the listing becomes sold at the agreed price, the seller's sales count
   * moves, and every other live offer on that listing is expired. A partial
   * apply here would leave a listing sold with no price, or two buyers both
   * told they had won it.
   */
  async accept(offerId: string, userId: string): Promise<OfferDto> {
    const { offer, chat } = await this.loadPending(offerId, userId);

    await this.dataSource.transaction(async (manager) => {
      // Re-read under the row lock: between loading and here, the counterpart
      // may have declined it or accepted a competing offer on the same listing.
      const locked = await manager.findOne(Offer, {
        where: { id: offerId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!locked || locked.status !== OfferStatus.PENDING) {
        throw new BadRequestException('Bu taklifga allaqachon javob berilgan');
      }

      const listing = await manager.findOne(Listing, {
        where: { id: locked.listingId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!listing) {
        throw new NotFoundException("E'lon topilmadi");
      }
      if (listing.status === ListingStatus.SOLD) {
        throw new BadRequestException("Bu e'lon allaqachon sotilgan");
      }

      await manager.update(Offer, offerId, {
        status: OfferStatus.ACCEPTED,
        respondedAt: new Date(),
      });

      await manager.update(Listing, listing.id, {
        status: ListingStatus.SOLD,
        soldAt: new Date(),
        // The agreed price, which is what the price index should learn from —
        // agricultural sales close below asking almost every time.
        soldPrice: locked.amount,
        soldQuantity: locked.quantity ?? listing.quantity,
      });

      await manager.increment(User, { id: listing.sellerId }, 'salesCount', 1);

      // Everyone else negotiating for this listing has lost it. Leaving their
      // offers pending would let a second acceptance land on a sold listing.
      await manager.update(
        Offer,
        { listingId: listing.id, status: OfferStatus.PENDING, id: Not(offerId) },
        { status: OfferStatus.EXPIRED, respondedAt: new Date() },
      );
    });

    await this.postSystem(
      chat,
      userId,
      `Kelishuv: ${this.money(offer.amount)} so'm/${offer.priceUnit}. Savdo yakunlandi.`,
    );

    // The feed and the price suggestions both change the moment a listing
    // sells, so their caches cannot be allowed to serve the old state.
    await this.redis.delByPattern('feed:v1:*');
    await this.redis.delByPattern('price:suggest:*');

    this.logger.log(
      `Offer ${offerId} accepted on listing ${offer.listingId} at ${offer.amount}`,
    );

    const fresh = await this.offers.findOneOrFail({ where: { id: offerId } });
    return this.toDto(fresh, userId, chat);
  }

  async decline(offerId: string, userId: string): Promise<OfferDto> {
    const { offer, chat } = await this.loadPending(offerId, userId);

    await this.offers.update(offerId, {
      status: OfferStatus.DECLINED,
      respondedAt: new Date(),
    });

    await this.postSystem(
      chat,
      userId,
      `Taklif rad etildi: ${this.money(offer.amount)} so'm/${offer.priceUnit}.`,
    );

    const fresh = await this.offers.findOneOrFail({ where: { id: offerId } });
    return this.toDto(fresh, userId, chat);
  }

  /** Withdrawing your own pending offer, so the counterpart is not left guessing. */
  async withdraw(offerId: string, userId: string): Promise<OfferDto> {
    const offer = await this.offers.findOne({ where: { id: offerId } });
    if (!offer) {
      throw new NotFoundException('Taklif topilmadi');
    }
    if (offer.senderId !== userId) {
      throw new ForbiddenException('Bu taklif sizniki emas');
    }
    if (offer.status !== OfferStatus.PENDING) {
      throw new BadRequestException('Bu taklifga allaqachon javob berilgan');
    }

    const chat = await this.loadChat(offer.chatId, userId);
    await this.offers.update(offerId, {
      status: OfferStatus.DECLINED,
      respondedAt: new Date(),
    });

    const fresh = await this.offers.findOneOrFail({ where: { id: offerId } });
    return this.toDto(fresh, userId, chat);
  }

  // ----------------------------------------------------------------- read

  async findForChat(chatId: string, userId: string): Promise<OfferDto[]> {
    const chat = await this.loadChat(chatId, userId);
    const rows = await this.offers.find({
      where: { chatId },
      order: { createdAt: 'DESC' },
    });
    return rows.map((offer) => this.toDto(offer, userId, chat));
  }

  // -------------------------------------------------------------- helpers

  private async loadChat(chatId: string, userId: string): Promise<Chat> {
    const chat = await this.chats.findOne({
      where: { id: chatId },
      relations: { listing: true },
    });
    if (!chat) {
      throw new NotFoundException('Suhbat topilmadi');
    }
    if (chat.buyerId !== userId && chat.sellerId !== userId) {
      throw new ForbiddenException('Bu suhbat sizniki emas');
    }
    return chat;
  }

  /** Loads a pending offer the caller is entitled to answer. */
  private async loadPending(
    offerId: string,
    userId: string,
  ): Promise<{ offer: Offer; chat: Chat }> {
    const offer = await this.offers.findOne({ where: { id: offerId } });
    if (!offer) {
      throw new NotFoundException('Taklif topilmadi');
    }
    if (offer.status !== OfferStatus.PENDING) {
      throw new BadRequestException('Bu taklifga allaqachon javob berilgan');
    }

    const chat = await this.loadChat(offer.chatId, userId);

    // You answer the other side's offer, never your own. Without this a seller
    // could accept their own asking price and close the sale unilaterally.
    if (offer.senderId === userId) {
      throw new ForbiddenException("O'z taklifingizga javob bera olmaysiz");
    }
    return { offer, chat };
  }

  /**
   * Writes the offer into the conversation as a message, so the timeline shows
   * the negotiation in order rather than in a separate panel the seller has to
   * remember to open. Reuses the chat's own bookkeeping — preview text and
   * unread counters — because a missed offer is worse than a missed message.
   */
  private async postToThread(
    chat: Chat,
    senderId: string,
    offer: Offer,
    body: string,
  ): Promise<void> {
    const senderIsBuyer = chat.buyerId === senderId;
    const recipientId = senderIsBuyer ? chat.sellerId : chat.buyerId;

    await this.dataSource.transaction(async (manager) => {
      const message = await manager.save(
        manager.create(Message, {
          chatId: chat.id,
          senderId,
          type: MessageType.OFFER,
          // The offer id travels in the body so the client can join the card to
          // its row without a second request per message.
          body: `${offer.id}|${body}`,
        }),
      );
      await manager.update(Chat, chat.id, {
        lastMessageAt: message.createdAt,
        lastMessageText: body.slice(0, PREVIEW_LENGTH),
      });
      await manager.increment(
        Chat,
        { id: chat.id },
        senderIsBuyer ? 'sellerUnreadCount' : 'buyerUnreadCount',
        1,
      );
    });

    void this.notifications
      .notifyOffer(recipientId, 'Yangi narx taklifi', body, chat.id, chat.listingId)
      .catch((error) => this.logger.warn(`Offer push failed: ${String(error)}`));
  }

  /** A system line both sides see, for accept and decline. */
  private async postSystem(chat: Chat, actorId: string, body: string): Promise<void> {
    const actorIsBuyer = chat.buyerId === actorId;
    const recipientId = actorIsBuyer ? chat.sellerId : chat.buyerId;

    await this.dataSource.transaction(async (manager) => {
      const message = await manager.save(
        manager.create(Message, {
          chatId: chat.id,
          senderId: actorId,
          type: MessageType.SYSTEM,
          body,
        }),
      );
      await manager.update(Chat, chat.id, {
        lastMessageAt: message.createdAt,
        lastMessageText: body.slice(0, PREVIEW_LENGTH),
      });
      await manager.increment(
        Chat,
        { id: chat.id },
        actorIsBuyer ? 'sellerUnreadCount' : 'buyerUnreadCount',
        1,
      );
    });

    void this.notifications
      .notifyOffer(recipientId, 'Agromagnat', body, chat.id, chat.listingId)
      .catch((error) => this.logger.warn(`Offer push failed: ${String(error)}`));
  }

  private async assertUnderRateLimit(userId: string): Promise<void> {
    const used = await this.redis.incrWithTtl(
      `offer:rate:${userId}`,
      OFFER_RATE_WINDOW_SECONDS,
    );
    if (used > OFFER_RATE_LIMIT) {
      throw new TooManyRequestsException(
        "Juda ko'p taklif yubordingiz. Birozdan keyin urinib ko'ring",
      );
    }
  }

  private offerPreview(offer: Offer): string {
    const volume = offer.quantity
      ? `${this.money(offer.quantity)} ${offer.quantityUnit ?? ''} uchun `
      : '';
    return `Taklif: ${volume}${this.money(offer.amount)} so'm/${offer.priceUnit}`;
  }

  /** Trims the trailing zeros a numeric column round-trips with. */
  private money(value: string): string {
    return String(Number(value))
      .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }

  private toDto(offer: Offer, viewerId: string, chat: Chat): OfferDto {
    const isMine = offer.senderId === viewerId;
    return {
      id: offer.id,
      chatId: offer.chatId,
      listingId: offer.listingId,
      fromRole: offer.fromRole,
      amount: offer.amount,
      priceUnit: offer.priceUnit,
      quantity: offer.quantity,
      quantityUnit: offer.quantityUnit,
      note: offer.note,
      status: offer.status,
      canRespond: offer.status === OfferStatus.PENDING && !isMine,
      isMine,
      createdAt: offer.createdAt.toISOString(),
      respondedAt: offer.respondedAt?.toISOString() ?? null,
    };
  }
}
