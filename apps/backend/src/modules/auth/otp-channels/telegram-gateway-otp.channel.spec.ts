import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { of, throwError } from 'rxjs';
import { TelegramGatewayOtpChannel } from './telegram-gateway-otp.channel';

/**
 * The cheap channel.
 *
 * Its job is to deliver for a penny where it can and to get out of the way
 * quickly where it cannot — a number with no Telegram account must fall through
 * to SMS, not become a person who cannot sign up. Every failure here has to
 * throw, because throwing is what the dispatcher reads as "try the next one".
 */
const SETTINGS = { token: 'gw-token', senderUsername: '', ttlSeconds: 300 };
const RECIPIENT = { phone: '+998901234567' };

describe('TelegramGatewayOtpChannel', () => {
  let channel: TelegramGatewayOtpChannel;
  let post: jest.Mock;
  let settings: typeof SETTINGS;

  beforeEach(async () => {
    post = jest.fn();
    settings = { ...SETTINGS };

    const moduleRef = await Test.createTestingModule({
      providers: [
        TelegramGatewayOtpChannel,
        { provide: HttpService, useValue: { post } },
        { provide: ConfigService, useValue: { getOrThrow: () => settings } },
      ],
    }).compile();

    channel = moduleRef.get(TelegramGatewayOtpChannel);
  });

  const reply = (data: unknown) => of({ status: 200, data });
  const canSend = () => reply({ ok: true, result: { request_id: 'req-1' } });

  describe('canReach', () => {
    it('is off entirely without a token', () => {
      settings.token = '';

      // A fresh checkout has no Gateway account, and a channel that always
      // fails would put a doomed request in front of every sign-in.
      expect(channel.canReach(RECIPIENT)).toBe(false);
    });

    it('is on once configured', () => {
      expect(channel.canReach(RECIPIENT)).toBe(true);
    });
  });

  describe('send', () => {
    it('asks whether the number can be reached before paying to try', async () => {
      post.mockReturnValueOnce(canSend()).mockReturnValueOnce(reply({ ok: true, result: {} }));

      await channel.send(RECIPIENT, '123456');

      expect(String(post.mock.calls[0][0])).toContain('/checkSendAbility');
      expect(post.mock.calls[0][1]).toEqual({ phone_number: '+998901234567' });
    });

    it('sends our own code, not one Telegram invents', async () => {
      post.mockReturnValueOnce(canSend()).mockReturnValueOnce(reply({ ok: true, result: {} }));

      await channel.send(RECIPIENT, '123456');

      // The code is already issued and stored in Redis; the person is checked
      // against that one, so a code generated anywhere else can never match.
      expect(post.mock.calls[1][1]).toMatchObject({
        code: '123456',
        request_id: 'req-1',
        ttl: 300,
      });
    });

    it('throws when the number has no Telegram, so SMS is tried', async () => {
      post.mockReturnValueOnce(reply({ ok: false, error: 'PHONE_NUMBER_NOT_FOUND' }));

      await expect(channel.send(RECIPIENT, '123456')).rejects.toThrow();

      // And it must not have spent anything trying.
      expect(post).toHaveBeenCalledTimes(1);
    });

    it('throws when the send itself is refused', async () => {
      post.mockReturnValueOnce(canSend()).mockReturnValueOnce(reply({ ok: false, error: 'BALANCE_TOO_LOW' }));

      await expect(channel.send(RECIPIENT, '123456')).rejects.toThrow(/BALANCE_TOO_LOW/);
    });

    it('throws when Telegram is unreachable', async () => {
      post.mockReturnValue(throwError(() => new Error('ETIMEDOUT')));

      // An outage at Telegram must become an SMS, not a failed sign-in.
      await expect(channel.send(RECIPIENT, '123456')).rejects.toThrow();
    });

    it('omits the sender when none is configured', async () => {
      post.mockReturnValueOnce(canSend()).mockReturnValueOnce(reply({ ok: true, result: {} }));

      await channel.send(RECIPIENT, '123456');

      // Telegram rejects an empty sender_username outright.
      expect(post.mock.calls[1][1]).not.toHaveProperty('sender_username');
    });

    it('includes the sender when one is configured', async () => {
      settings.senderUsername = 'agromagnat';
      post.mockReturnValueOnce(canSend()).mockReturnValueOnce(reply({ ok: true, result: {} }));

      await channel.send(RECIPIENT, '123456');

      expect(post.mock.calls[1][1]).toMatchObject({ sender_username: 'agromagnat' });
    });

    it('keeps whole phone numbers out of the error text', async () => {
      post.mockReturnValueOnce(reply({ ok: false, error: 'PHONE_NUMBER_NOT_FOUND' }));

      const error = await channel.send(RECIPIENT, '123456').catch((e: Error) => e);

      // Logs get shipped, read and pasted into chats. A full number in one is a
      // customer's contact detail leaving the system for no reason.
      expect(String(error)).not.toContain('998901234567');
      expect(String(error)).toContain('****');
    });
  });
});
