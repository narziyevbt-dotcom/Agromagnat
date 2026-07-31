import { Body, Controller, ForbiddenException, Headers, Logger, Post } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Public } from '../../auth/decorators/public.decorator';
import { User } from '../../users/entities/user.entity';
import { TelegramService } from './telegram.service';

/** Telegram sends the configured secret back in this header on every call. */
const SECRET_HEADER = 'x-telegram-bot-api-secret-token';

interface TelegramUpdate {
  message?: {
    chat?: { id?: number };
    from?: { id?: number };
    text?: string;
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

    const chatId = update.message?.chat?.id;
    const text = update.message?.text?.trim() ?? '';

    if (chatId && text.startsWith('/start')) {
      await this.bind(String(chatId), text.slice('/start'.length).trim());
    }

    // Telegram retries anything that is not a 2xx, so an unrecognised update
    // is acknowledged rather than rejected — there is nothing to retry.
    return { ok: true };
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
