import { Inject, Injectable, Logger } from '@nestjs/common';
import { OTP_CHANNELS, OtpChannel, OtpRecipient } from './otp-channel';

/**
 * Picks a channel and falls through when one fails.
 *
 * Order is cost, not preference: Telegram is free and instant, SMS is neither.
 * At any real volume the difference between them is most of the OTP bill, so
 * the cheap channel is tried first for every person we can reach on it.
 *
 * A channel that throws is a channel that did not deliver, and the next one is
 * tried. Only when every channel has failed does the caller hear about it —
 * because a person who cannot receive a code cannot use the product at all.
 */
@Injectable()
export class OtpDispatcher {
  private readonly logger = new Logger('Otp');

  constructor(@Inject(OTP_CHANNELS) private readonly channels: OtpChannel[]) {}

  /** Returns the channel that actually delivered, so the UI can say where to look. */
  async deliver(recipient: OtpRecipient, code: string): Promise<OtpChannel['name']> {
    const usable = this.channels.filter((channel) => channel.canReach(recipient));

    if (!usable.length) {
      throw new Error('No OTP channel can reach this recipient');
    }

    for (const channel of usable) {
      try {
        await channel.send(recipient, code);
        return channel.name;
      } catch (error) {
        // Not fatal on its own: the next channel exists precisely for this.
        this.logger.warn(`${channel.name} delivery failed, trying next: ${String(error)}`);
      }
    }

    throw new Error('Every OTP channel failed');
  }
}
