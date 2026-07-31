import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import type { TelegramConfig } from '../../../config/configuration';
import { RedisService } from '../../../redis/redis.service';

/**
 * Signing in through the bot, for nothing.
 *
 * Every other way of proving a phone number costs money: an SMS costs money,
 * Telegram Gateway costs money. This costs nothing at all, and the proof is
 * stronger — the number comes from Telegram's own contact card, which Telegram
 * verified when the account was created. There is no code to send, intercept,
 * mistype or wait for.
 *
 * The shape:
 *
 *   1. The browser asks for a ticket and opens `t.me/<bot>?start=<ticket>`.
 *   2. The bot answers with one button: share your number.
 *   3. Telegram posts the contact to our webhook. If the contact belongs to the
 *      person who sent it, the number is proved.
 *   4. The browser, still polling its ticket, collects the session.
 *
 * A ticket is single-use and lives two minutes. That window is the whole
 * security boundary of the flow: anyone who can make a victim open *their*
 * ticket link ends up signed in as the victim, so it must be short, unguessable
 * and burned on first use — and the bot says out loud what is being authorised,
 * so a person who did not start it can stop.
 */
const TICKET_TTL_SECONDS = 120;

/** How long a completed session waits to be collected by the browser. */
const RESULT_TTL_SECONDS = 60;

export interface TelegramTicket {
  ticket: string;
  deepLink: string;
  expiresIn: number;
}

/** What the webhook leaves behind for the browser to pick up. */
export interface TicketResult {
  phone: string;
  telegramChatId: string;
  name: string | null;
}

@Injectable()
export class TelegramLinkService {
  private readonly logger = new Logger('TelegramLink');

  constructor(
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {}

  private get settings(): TelegramConfig {
    return this.config.getOrThrow<TelegramConfig>('telegram');
  }

  get isConfigured(): boolean {
    return Boolean(this.settings.botToken && this.settings.botUsername);
  }

  /**
   * Telegram's `start` payload allows only `A-Za-z0-9_-`, up to 64 characters,
   * which base64url happens to satisfy exactly.
   */
  async issue(): Promise<TelegramTicket> {
    const ticket = randomBytes(24).toString('base64url');
    await this.redis.raw.set(this.pendingKey(ticket), '1', 'EX', TICKET_TTL_SECONDS);

    return {
      ticket,
      deepLink: `https://t.me/${this.settings.botUsername}?start=${ticket}`,
      expiresIn: TICKET_TTL_SECONDS,
    };
  }

  /** True while the ticket is live and unspent. */
  async isPending(ticket: string): Promise<boolean> {
    return (await this.redis.raw.exists(this.pendingKey(ticket))) === 1;
  }

  /**
   * Burns the ticket and records the proof.
   *
   * Burning first is the point: two contacts arriving for one ticket must
   * produce one session, not two, and a replayed webhook must find nothing.
   */
  async complete(ticket: string, result: TicketResult): Promise<boolean> {
    const burned = await this.redis.del(this.pendingKey(ticket));
    if (burned === 0) {
      this.logger.warn('Telegram contact arrived for an expired or spent ticket');
      return false;
    }

    await this.redis.set(this.resultKey(ticket), result, RESULT_TTL_SECONDS);
    return true;
  }

  /**
   * Collects the proof, once.
   *
   * Also single-use: the browser polls this, and a result left lying around is
   * a session anybody who learns the ticket can claim.
   */
  async collect(ticket: string): Promise<TicketResult | null> {
    const result = await this.redis.get<TicketResult>(this.resultKey(ticket));
    if (result) {
      await this.redis.del(this.resultKey(ticket));
    }
    return result;
  }

  /**
   * Remembers which ticket a chat is answering.
   *
   * Telegram delivers the shared contact as its own update with no trace of the
   * `/start` payload that asked for it, so the link between the two has to be
   * held here for the seconds in between.
   */
  async rememberTicketFor(chatId: string, ticket: string): Promise<void> {
    await this.redis.raw.set(this.chatKey(chatId), ticket, 'EX', TICKET_TTL_SECONDS);
  }

  async ticketFor(chatId: string): Promise<string | null> {
    const ticket = await this.redis.raw.get(this.chatKey(chatId));
    if (ticket) {
      // One contact per request. A second card sent into the same chat must
      // start a new sign-in rather than reuse this one.
      await this.redis.del(this.chatKey(chatId));
    }
    return ticket;
  }

  private chatKey(chatId: string): string {
    return `tglink:chat:${chatId}`;
  }

  private pendingKey(ticket: string): string {
    return `tglink:pending:${ticket}`;
  }

  private resultKey(ticket: string): string {
    return `tglink:result:${ticket}`;
  }
}
