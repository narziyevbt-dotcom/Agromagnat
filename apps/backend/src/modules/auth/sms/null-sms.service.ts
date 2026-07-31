import { Injectable, Logger } from '@nestjs/common';
import { SmsService } from './sms.service';

/**
 * No SMS provider at all — `SMS_PROVIDER=none`.
 *
 * For a launch that reaches people over Telegram Gateway before any aggregator
 * contract exists. Somebody whose number has no Telegram cannot sign up yet,
 * which is a smaller problem than not launching, and it stops being a problem
 * the day Eskiz is switched on.
 *
 * Deliberately not the mock: the mock pretends the message was delivered and
 * fixes every code at 000000, which in production is the whole security model
 * gone. This one refuses honestly, so the dispatcher reports "we could not
 * reach you" rather than a code that was never sent.
 */
@Injectable()
export class NullSmsService implements SmsService {
  private readonly logger = new Logger('Sms');

  async send(phone: string): Promise<boolean> {
    this.logger.warn(
      `No SMS provider configured; ${phone.slice(0, 7)}****${phone.slice(-2)} ` +
        'could not be reached. Set SMS_PROVIDER=eskiz to cover numbers without Telegram.',
    );
    return false;
  }
}
