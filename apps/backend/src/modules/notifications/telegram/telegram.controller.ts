import { Body, Controller, ForbiddenException, Headers, Logger, Post } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Public } from '../../auth/decorators/public.decorator';
import { User } from '../../users/entities/user.entity';
import { TelegramLinkService } from '../../auth/telegram-link/telegram-link.service';
import { TelegramService } from './telegram.service';

/** Telegram sends the configured secret back in this header on every call. */
const SECRET_HEADER = 'x-telegram-bot-api-secret-token';

interface TelegramUpdate {
  message?: {
    chat?: { id?: number };
    from?: { id?: number; first_name?: string; last_name?: string };
    text?: string;
    /**
     * A shared contact card. `user_id` is the Telegram account it belongs to,
     * and comparing it to `from.id` is the whole security check: without it,
     * anybody could forward somebody else's contact and claim their number.
     */
    contact?: {
      phone_number?: string;
      user_id?: number;
      first_name?: string;
      last_name?: string;
    };
  };
}

/**
 * The bot's webhook.
 *
 * Its only job is binding: when somebody sends `/start <token>` the chat id is
 * written onto their account, and from then on their one-time codes arrive over
 * Telegram for free instead of over SMS for money.
 *
 * Public in the routing sense and authenticated in the real one — by the secret
 * Telegram echoes back. Without that check anyone who guessed the URL could
 * post a forged update and bind their own chat to somebody else's account,
 * which would hand them that person's login codes.
 *
 * Excluded from Swagger: it is not part of the product's API surface, and
 * publishing its shape only helps somebody trying to forge one.
 */
@Public()
@ApiExcludeController()
@Controller('telegram')
export class TelegramController {
  private readonly logger = new Logger('Telegram');

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly telegram: TelegramService,
    private readonly link: TelegramLinkService,
  ) {}

  @Post('webhook')
  async webhook(
    @Headers(SECRET_HEADER) secret: string | undefined,
    @Body() update: TelegramUpdate,
  ): Promise<{ ok: true }> {
    const expected = this.telegram.webhookSecret;

    // No secret configured means the bot was never set up; refuse rather than
    // accept everything, which is what an empty-string comparison would do.
    if (!expected || secret !== expected) {
      throw new ForbiddenException();
    }

    const message = update.message;
    const chatId = message?.chat?.id;
    const text = message?.text?.trim() ?? '';

    if (chatId && message?.contact) {
      await this.acceptContact(String(chatId), message);
    } else if (chatId && text.startsWith('/start')) {
      await this.start(String(chatId), text.slice('/start'.length).trim());
    }

    // Telegram retries anything that is not a 2xx, so an unrecognised update
    // is acknowledged rather than rejected — there is nothing to retry.
    return { ok: true };
  }

  /**
   * `/start` with a payload. Two kinds arrive here.
   *
   * A uuid is an existing account binding its chat, so its future codes arrive
   * over Telegram instead of over SMS. Anything else is a sign-in ticket from
   * the website, and the answer is a button asking for the person's number.
   */
  private async start(chatId: string, payload: string): Promise<void> {
    if (/^[0-9a-f-]{36}$/i.test(payload)) {
      await this.bind(chatId, payload);
      return;
    }

    if (payload && (await this.link.isPending(payload))) {
      await this.askForNumber(chatId, payload);
      return;
    }

    // No payload, an expired ticket, or somebody who simply opened the bot.
    await this.telegram
      .sendMessage(
        chatId,
        'Salom! Agromagnat botiga xush kelibsiz.\n\n' +
          'Kirish uchun saytdagi “Telegram orqali kirish” tugmasini bosing.',
      )
      .catch(() => undefined);
  }

  /**
   * The one button that replaces the entire SMS bill.
   *
   * Telegram will only attach a contact card to this if the person taps it
   * themselves, and the number on it is one Telegram verified when the account
   * was made. That is a stronger proof than a code we send to the number and
   * hope reaches the right hands.
   */
  private async askForNumber(chatId: string, ticket: string): Promise<void> {
    // Written before the message is sent, not after. This is the state that
    // matters — the contact arrives as a separate update with no payload of its
    // own, and only this binding can match it back to the ticket. Recording it
    // after a send that fails loses the sign-in even when the person goes on to
    // tap the button from an earlier message.
    await this.link.rememberTicketFor(chatId, ticket);

    await this.telegram
      .sendMessage(
        chatId,
        '<b>Agromagnat</b> saytiga kirmoqchisiz.\n\n' +
          'Tasdiqlash uchun pastdagi tugmani bosing — raqamingiz faqat kirish ' +
          'uchun ishlatiladi.\n\n' +
          '<i>Agar buni siz boshlamagan bo‘lsangiz, shunchaki e’tibor bermang.</i>',
        {
          keyboard: [[{ text: '📱 Raqamimni yuborish', request_contact: true }]],
          resize_keyboard: true,
          one_time_keyboard: true,
        },
      )
      .catch((error) => {
        // Never let a failed send fail the webhook. Telegram retries anything
        // that is not a 2xx, so throwing here turns one bad send into an
        // endless redelivery loop of the same update.
        this.logger.error(`Could not ask for a number: ${String(error)}`);
      });
  }

  /**
   * The contact came back. This is where a person becomes verified.
   */
  private async acceptContact(
    chatId: string,
    message: NonNullable<TelegramUpdate['message']>,
  ): Promise<void> {
    const contact = message.contact!;

    // Without this, forwarding a friend's contact card would sign you in as
    // them. Telegram sets `user_id` only for a genuine Telegram account, and it
    // must be the account that sent the message.
    if (!contact.user_id || contact.user_id !== message.from?.id) {
      await this.telegram
        .sendMessage(
          chatId,
          'Faqat <b>o‘z</b> raqamingizni yuborishingiz mumkin. ' +
            'Iltimos, tugmani ishlating.',
        )
        .catch(() => undefined);
      return;
    }

    const ticket = await this.link.ticketFor(chatId);
    if (!ticket) {
      await this.telegram
        .sendMessage(chatId, 'Kirish so‘rovi eskirgan. Saytda qaytadan urinib ko‘ring.')
        .catch(() => undefined);
      return;
    }

    const digits = String(contact.phone_number ?? '').replace(/\D/g, '');
    if (!/^998\d{9}$/.test(digits)) {
      await this.telegram
        .sendMessage(chatId, 'Hozircha faqat O‘zbekiston raqamlari qabul qilinadi.')
        .catch(() => undefined);
      return;
    }

    const name =
      [contact.first_name, contact.last_name].filter(Boolean).join(' ').trim() || null;

    const stored = await this.link.complete(ticket, {
      phone: `+${digits}`,
      telegramChatId: chatId,
      name,
    });

    await this.telegram
      .sendMessage(
        chatId,
        stored
          ? '✅ Tasdiqlandi. Saytga qayting — kirish yakunlandi.'
          : 'Kirish so‘rovi eskirgan. Saytda qaytadan urinib ko‘ring.',
        // The contact keyboard has done its job; leaving it up invites a second
        // tap that can only fail.
        { remove_keyboard: true },
      )
      .catch(() => undefined);
  }

  /**
   * `/start <userId>` binds the chat. The deep link the web app builds carries
   * the id, so the person never types anything.
   *
   * An unknown or malformed id is ignored silently: replying "no such account"
   * to an arbitrary uuid would turn the bot into an oracle for which accounts
   * exist.
   */
  private async bind(chatId: string, payload: string): Promise<void> {
    if (!/^[0-9a-f-]{36}$/i.test(payload)) {
      return;
    }

    const user = await this.users.findOne({ where: { id: payload } });
    if (!user) {
      return;
    }

    // The chat may already be bound to another account — somebody re-linking
    // after switching accounts. The newest binding wins, and the old one is
    // cleared first because the column is unique.
    await this.users.update({ telegramChatId: chatId }, { telegramChatId: null });
    await this.users.update(user.id, { telegramChatId: chatId });

    await this.telegram
      .sendMessage(
        chatId,
        'Agromagnat bilan bog‘landi. Endi tasdiqlash kodlari shu yerga keladi.',
      )
      .catch((error) => this.logger.warn(`Bind confirmation failed: ${String(error)}`));

    this.logger.log(`Telegram chat ${chatId} bound to user ${user.id}`);
  }
}
