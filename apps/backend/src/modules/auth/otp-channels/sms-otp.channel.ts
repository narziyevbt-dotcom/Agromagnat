import { Inject, Injectable } from '@nestjs/common';
import { SMS_SERVICE, SmsService } from '../sms/sms.service';
import { OtpChannel, OtpRecipient } from './otp-channel';

/**
 * The fallback, and the only channel that works for somebody who has never
 * opened Telegram. Always reachable, which is what makes it the last rung.
 */
@Injectable()
export class SmsOtpChannel implements OtpChannel {
  readonly name = 'sms' as const;

  constructor(@Inject(SMS_SERVICE) private readonly sms: SmsService) {}

  canReach(recipient: OtpRecipient): boolean {
    return Boolean(recipient.phone);
  }

  async send(recipient: OtpRecipient, code: string): Promise<void> {
    const delivered = await this.sms.send(
      recipient.phone,
      `Agromagnat tasdiqlash kodi: ${code}. Kodni hech kimga bermang.`,
    );

    // The provider rejected it — a dead number, a blocked route. Throwing lets
    // the dispatcher fall through to the next channel rather than reporting a
    // success the person will never see.
    if (!delivered) {
      throw new Error('SMS provider rejected the message');
    }
  }
}
