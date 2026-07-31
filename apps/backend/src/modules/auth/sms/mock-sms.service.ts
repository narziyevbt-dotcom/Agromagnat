import { Injectable, Logger } from '@nestjs/common';
import { SmsService } from './sms.service';

/**
 * Development provider. Nothing leaves the process — the OTP is printed to the
 * console so the whole login flow can be exercised without spending Eskiz credit.
 */
@Injectable()
export class MockSmsService implements SmsService {
  private readonly logger = new Logger('MockSms');

  async send(phone: string, text: string): Promise<boolean> {
    this.logger.log(`SMS -> ${phone}: ${text}`);
    return true;
  }
}
