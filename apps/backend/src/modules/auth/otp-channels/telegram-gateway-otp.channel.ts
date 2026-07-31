import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import type { TelegramGatewayConfig } from '../../../config/configuration';
import { classify, explain } from './gateway-errors';
import { OtpChannel, OtpRecipient } from './otp-channel';

const BASE_URL = 'https://gatewayapi.telegram.org';

/**
 * Telegram Gateway — a code straight to the phone number's Telegram account.
 *
 * Different from the bot channel next to it, and the difference is the point.
 * The bot can only reach somebody who has already started it, which they can
 * only do once they have an account — so it is useless for the one message
 * that matters most, the first one. Gateway takes a phone number and finds the
 * Telegram account itself, so it works for a brand-new visitor.
 *
 * Why it is here at all: it needs no local aggregator contract, no company
 * documents, no template moderation, and it is roughly $0.01 a code against an
 * SMS. In a market where nearly every phone has Telegram, that is most of the
 * OTP bill and most of the waiting.
 *
 * It is not a replacement for SMS. A number with no Telegram account cannot be
 * reached this way, and refusing those people would be refusing customers — so
 * this sits in front of SMS, not instead of it.
 */
@Injectable()
export class TelegramGatewayOtpChannel implements OtpChannel {
  readonly name = 'telegram_gateway' as const;
  private readonly logger = new Logger('TelegramGateway');

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  private get settings(): TelegramGatewayConfig {
    return this.config.getOrThrow<TelegramGatewayConfig>('telegramGateway');
  }

  /**
   * Only "is this configured". Whether *this* number has Telegram is a question
   * for Telegram, asked in `send` — guessing it here would either turn away
   * people we could have reached for a penny, or claim reach we do not have.
   */
  canReach(_recipient: OtpRecipient): boolean {
    return Boolean(this.settings.token);
  }

  async send(recipient: OtpRecipient, code: string): Promise<void> {
    // Asked first because it is free, and because it is the difference between
    // falling through to SMS in a second and after a timeout. Telegram refunds
    // undelivered codes, but a refund is not a delivered code.
    const ability = await this.post('/checkSendAbility', {
      phone_number: recipient.phone,
    });

    const requestId = ability?.result?.request_id;
    if (!ability?.ok || !requestId) {
      this.report(ability?.error, recipient.phone);
      throw new Error(
        `Telegram cannot reach ${maskPhone(recipient.phone)}: ${describe(ability)}`,
      );
    }

    // Our own code, not one Telegram generates: it is already issued and stored
    // in Redis, and the code the person is checked against has to be that one.
    const sent = await this.post('/sendVerificationMessage', {
      phone_number: recipient.phone,
      request_id: requestId,
      code,
      ttl: this.settings.ttlSeconds,
      ...(this.settings.senderUsername
        ? { sender_username: this.settings.senderUsername }
        : {}),
    });

    if (!sent?.ok) {
      this.report(sent?.error, recipient.phone);
      throw new Error(`Telegram Gateway refused the code: ${describe(sent)}`);
    }

    const status = String(sent.result?.delivery_status?.status ?? 'sent');
    this.logger.log(
      `Code delivered to ${maskPhone(recipient.phone)} over Telegram (${status})`,
    );
  }

  /**
   * An unreachable number is routine and belongs at debug; an empty account is
   * an outage of this whole channel and belongs where somebody will see it.
   * Logging both the same way is how "the SMS bill tripled" becomes the first
   * anybody hears of it.
   */
  private report(error: string | undefined, phone: string): void {
    const fault = classify(error);
    const message = `${explain(fault, error)} (${maskPhone(phone)})`;

    if (fault === 'account' || fault === 'config') {
      this.logger.error(message);
    } else {
      this.logger.debug(message);
    }
  }

  private async post(path: string, body: Record<string, unknown>): Promise<GatewayReply> {
    const response = await firstValueFrom(
      this.http.post<GatewayReply>(`${BASE_URL}${path}`, body, {
        headers: { Authorization: `Bearer ${this.settings.token}` },
        // A slow provider must not hold up the sign-in request; SMS is waiting
        // behind it and the person is watching a spinner.
        timeout: 8_000,
        // Non-2xx carries the reason in the body, and the reason is what the
        // log needs — letting axios throw would discard it.
        validateStatus: () => true,
      }),
    );
    return response.data;
  }
}

interface GatewayReply {
  ok?: boolean;
  error?: string;
  result?: {
    request_id?: string;
    delivery_status?: { status?: string };
  };
}

const describe = (reply: GatewayReply | undefined): string =>
  reply?.error ?? JSON.stringify(reply ?? null);

/** Phone numbers do not belong in logs in full. */
const maskPhone = (phone: string): string => `${phone.slice(0, 7)}****${phone.slice(-2)}`;
