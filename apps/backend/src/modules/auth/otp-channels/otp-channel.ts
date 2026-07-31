/**
 * How a one-time code reaches a person.
 *
 * Three implementations today, chosen per person rather than per deployment,
 * and ordered by cost:
 *
 * 1. Telegram Gateway — takes a phone number and finds the Telegram account
 *    itself, so it works for a brand-new visitor. ~$0.01 a code, no local
 *    aggregator contract, no template moderation.
 * 2. The bot — free, but only reaches somebody who has already started it,
 *    which they can only do once they have an account.
 * 3. SMS — works for everyone and costs the most.
 *
 * That order is a cost decision as much as a delivery one, and in this market
 * Telegram is on nearly every phone. At any real volume the difference between
 * the first and the last is most of the OTP bill.
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
  readonly name: 'telegram_gateway' | 'telegram' | 'sms';

  /** Whether this channel can reach this particular person right now. */
  canReach(recipient: OtpRecipient): boolean;

  /** Resolves when handed off to the provider; throws so the next channel is tried. */
  send(recipient: OtpRecipient, code: string): Promise<void>;
}
