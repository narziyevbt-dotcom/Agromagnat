import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TelegramConfig } from '../../../config/configuration';

const API_BASE = 'https://api.telegram.org/bot';

/** Telegram drops a bot that is slow to answer; never block a request on it. */
const SEND_TIMEOUT_MS = 5_000;

/**
 * The Telegram bot, as a transport.
 *
 * Deliberately thin and library-free: `node-telegram-bot-api` and friends bring
 * a polling loop, an event emitter and a plugin system for what is two HTTPS
 * calls. Webhooks also scale where polling does not — a polling bot pins one
 * process, so the API could never run more than one replica.
 *
 * Nothing here knows about OTPs. It sends a message to a chat; what to send and
 * to whom belongs to the channel that uses it.
 */
@Injectable()
export class TelegramService {
  private readonly logger = new Logger('Telegram');

  constructor(private readonly config: ConfigService) {}

  private get settings(): TelegramConfig {
    return this.config.getOrThrow<TelegramConfig>('telegram');
  }

  get isConfigured(): boolean {
    return Boolean(this.settings.botToken);
  }

  /** The secret Telegram echoes on every webhook call, so forgeries are cheap to reject. */
  get webhookSecret(): string {
    return this.settings.webhookSecret;
  }

  /**
   * @param replyMarkup A Telegram keyboard. The one that matters here is
   *   `request_contact`, which is what makes free phone verification possible:
   *   the number Telegram attaches to a shared contact is one Telegram has
   *   already verified, so no code has to be sent or checked at all.
   */
  async sendMessage(
    chatId: string,
    html: string,
    replyMarkup?: Record<string, unknown>,
  ): Promise<void> {
    const { botToken } = this.settings;
    if (!botToken) {
      throw new Error('Telegram bot is not configured');
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);

    try {
      const response = await fetch(`${API_BASE}${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: html,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
          ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`Telegram ${response.status}: ${body.slice(0, 200)}`);
      }
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Points Telegram at our webhook. Run once per deployment rather than on
   * every boot: Telegram treats an identical re-registration as a no-op, but a
   * crash loop would still hammer it.
   */
  async registerWebhook(url: string): Promise<void> {
    const { botToken, webhookSecret } = this.settings;
    if (!botToken) return;

    const response = await fetch(`${API_BASE}${botToken}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url,
        secret_token: webhookSecret || undefined,
        allowed_updates: ['message'],
      }),
    });

    this.logger.log(
      response.ok ? `Telegram webhook set to ${url}` : `setWebhook failed: ${response.status}`,
    );
  }
}
