/**
 * How a one-time code reaches a person.
 *
 * Two implementations today, chosen per user rather than per deployment:
 * Telegram when we know their chat, SMS otherwise. That order is a cost
 * decision as much as a delivery one — Telegram is free and instant, an SMS is
 * neither, and in this market Telegram is on nearly every phone. At any real
 * volume the difference between the two is most of the OTP bill.
 *
 * The interface exists so a third channel — a push to an installed app, say —
 * is a new class rather than an edit to the auth service.
 */
export const OTP_CHANNELS = Symbol('OTP_CHANNELS');

export interface OtpRecipient {
  /** E.164, always present: it is what the code authorises. */
  phone: string;
  /** Present once the person has started the bot. */
  telegramChatId?: string | null;
}

export interface OtpChannel {
  /** Stable name, used in logs and in the response so clients can say where to look. */
  readonly name: 'telegram' | 'sms';

  /** Whether this channel can reach this particular person right now. */
  canReach(recipient: OtpRecipient): boolean;

  /** Resolves when handed off to the provider; throws so the next channel is tried. */
  send(recipient: OtpRecipient, code: string): Promise<void>;
}
