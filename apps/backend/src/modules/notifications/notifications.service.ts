import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { DevicePlatform, DeviceToken } from './entities/device-token.entity';
import { PUSH_SERVICE, PushMessage, PushService } from './push/push.service';

/** Notification body preview. Longer than this and Android truncates it anyway. */
const PREVIEW_LENGTH = 120;

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger('Notifications');

  constructor(
    @InjectRepository(DeviceToken) private readonly devices: Repository<DeviceToken>,
    @Inject(PUSH_SERVICE) private readonly push: PushService,
  ) {}

  // ------------------------------------------------------------- registration

  /**
   * Registers a device for the caller.
   *
   * The token is the identity, not the (user, token) pair: two accounts on one
   * handset share an FCM token, and the second login must move it rather than
   * duplicate it — otherwise the first account keeps receiving the second's
   * messages on a device it no longer owns.
   */
  async registerDevice(
    userId: string,
    token: string,
    platform: DevicePlatform,
  ): Promise<DeviceToken> {
    const existing = await this.devices.findOne({ where: { token } });

    if (existing) {
      existing.userId = userId;
      existing.platform = platform;
      return this.devices.save(existing);
    }

    return this.devices.save(this.devices.create({ userId, token, platform }));
  }

  /** Unregisters on logout. Scoped to the caller so a token cannot be revoked for someone else. */
  async unregisterDevice(userId: string, token: string): Promise<void> {
    await this.devices.delete({ userId, token });
  }

  // -------------------------------------------------------------- delivery

  async notifyNewMessage(
    recipientId: string,
    senderName: string | null,
    listingTitle: string,
    body: string,
    chatId: string,
  ): Promise<void> {
    await this.sendToUser(recipientId, {
      title: senderName ?? 'Yangi xabar',
      body: `${listingTitle}: ${truncate(body)}`,
      data: { type: 'chat_message', chatId },
    });
  }

  async notifyNewReview(
    sellerId: string,
    rating: number,
    authorName: string | null,
  ): Promise<void> {
    await this.sendToUser(sellerId, {
      title: 'Yangi baho',
      body: `${authorName ?? 'Xaridor'} sizga ${rating} yulduz qo'ydi`,
      data: { type: 'review', rating: String(rating) },
    });
  }

  /**
   * Fans a message out to every device a user has registered, then prunes the
   * ones the provider retired. Never throws: notification delivery is a side
   * effect of an action that has already succeeded, so a failure here must not
   * roll it back or surface as an error to the user.
   */
  async sendToUser(userId: string, message: PushMessage): Promise<void> {
    try {
      const devices = await this.devices.find({ where: { userId } });
      if (!devices.length) {
        return;
      }

      const tokens = devices.map((device) => device.token);
      const { sent, invalidTokens } = await this.push.send(tokens, message);

      if (invalidTokens.length) {
        await this.devices.delete({ token: In(invalidTokens) });
      }
      if (sent > 0) {
        const live = tokens.filter((token) => !invalidTokens.includes(token));
        await this.devices.update({ token: In(live) }, { lastUsedAt: new Date() });
      }
    } catch (error) {
      this.logger.warn(`Push to ${userId} failed: ${String(error)}`);
    }
  }
}

const truncate = (text: string): string =>
  text.length <= PREVIEW_LENGTH ? text : `${text.slice(0, PREVIEW_LENGTH - 1)}…`;
