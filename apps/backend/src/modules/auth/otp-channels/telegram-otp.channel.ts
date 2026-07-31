import { Injectable, Logger } from '@nestjs/common';
import { TelegramService } from '../../notifications/telegram/telegram.service';
import { OtpChannel, OtpRecipient } from './otp-channel';

/**
 * Delivers the code over Telegram, which is free and arrives in a second.
 *
 * Only usable once we know the person's chat id, which they give us by
 * starting the bot. Until then `canReach` is false and the SMS channel takes
 * over — the flow never depends on Telegram being set up.
 */
@Injectable()
export class TelegramOtpChannel implements OtpChannel {
  readonly name = 'telegram' as const;
  private readonly logger = new Logger('OtpTelegram');

  constructor(private readonly telegram: TelegramService) {}

  canReach(recipient: OtpRecipient): boolean {
    return this.telegram.isConfigured && Boolean(recipient.telegramChatId);
  }

  async send(recipient: OtpRecipient, code: string): Promise<void> {
    await this.telegram.sendMessage(
      recipient.telegramChatId!,
      `<b>${code}</b> — Agromagnat tasdiqlash kodi.\n\nKodni hech kimga bermang. ` +
        `Agar bu siz bo'lmasangiz, e'tibor bermang.`,
    );
    this.logger.log(`OTP delivered over Telegram to ${recipient.telegramChatId}`);
  }
}
