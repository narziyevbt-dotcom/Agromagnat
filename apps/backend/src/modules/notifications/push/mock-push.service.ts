import { Injectable, Logger } from '@nestjs/common';
import { PushMessage, PushResult, PushService } from './push.service';

/**
 * Development provider. Nothing leaves the process — the notification is printed
 * so the whole chat flow can be exercised without a Firebase project.
 */
@Injectable()
export class MockPushService implements PushService {
  private readonly logger = new Logger('MockPush');

  async send(tokens: string[], message: PushMessage): Promise<PushResult> {
    for (const token of tokens) {
      this.logger.log(`PUSH -> ${token.slice(0, 12)}…: ${message.title} — ${message.body}`);
    }
    return { sent: tokens.length, invalidTokens: [] };
  }
}
