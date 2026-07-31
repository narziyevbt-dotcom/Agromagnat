import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { DevicePlatform, DeviceToken } from './entities/device-token.entity';
import { NotificationsService } from './notifications.service';
import { PUSH_SERVICE, PushResult } from './push/push.service';

type MockRepo<T extends object> = Partial<Record<keyof Repository<T>, jest.Mock>>;

const USER = '11111111-1111-1111-1111-111111111111';
const OTHER_USER = '22222222-2222-2222-2222-222222222222';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let devices: MockRepo<DeviceToken>;
  let push: { send: jest.Mock };

  const result = (over: Partial<PushResult> = {}): PushResult => ({
    sent: 1,
    invalidTokens: [],
    ...over,
  });

  beforeEach(async () => {
    devices = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      save: jest.fn(async (value) => value as DeviceToken),
      create: jest.fn((value) => value as DeviceToken),
      update: jest.fn(),
      delete: jest.fn(),
    };
    push = { send: jest.fn().mockResolvedValue(result()) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: getRepositoryToken(DeviceToken), useValue: devices },
        { provide: PUSH_SERVICE, useValue: push },
      ],
    }).compile();

    service = moduleRef.get(NotificationsService);
  });

  describe('registerDevice', () => {
    it('creates a row for a token seen for the first time', async () => {
      devices.findOne!.mockResolvedValue(null);

      await service.registerDevice(USER, 'token-abc', DevicePlatform.ANDROID);

      expect(devices.save).toHaveBeenCalledWith(
        expect.objectContaining({ userId: USER, token: 'token-abc' }),
      );
    });

    it('moves a token to the account that just logged in on that handset', async () => {
      devices.findOne!.mockResolvedValue({
        id: 'device-1',
        userId: OTHER_USER,
        token: 'token-abc',
      });

      await service.registerDevice(USER, 'token-abc', DevicePlatform.ANDROID);

      // Not a second row: the previous owner must stop receiving on this device.
      expect(devices.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'device-1', userId: USER }),
      );
    });
  });

  describe('sendToUser', () => {
    it('does not call the provider when the user has no devices', async () => {
      devices.find!.mockResolvedValue([]);

      await service.sendToUser(USER, { title: 'a', body: 'b' });

      expect(push.send).not.toHaveBeenCalled();
    });

    it('deletes the tokens the provider retired', async () => {
      devices.find!.mockResolvedValue([
        { token: 'live' },
        { token: 'dead' },
      ] as DeviceToken[]);
      push.send.mockResolvedValue(result({ sent: 1, invalidTokens: ['dead'] }));

      await service.sendToUser(USER, { title: 'a', body: 'b' });

      expect(devices.delete).toHaveBeenCalledWith({ token: In(['dead']) });
      // Only the surviving token gets its last-used stamp refreshed.
      expect(devices.update).toHaveBeenCalledWith({ token: In(['live']) }, expect.anything());
    });

    it('swallows a provider failure — a push must not undo the action behind it', async () => {
      devices.find!.mockResolvedValue([{ token: 'live' }] as DeviceToken[]);
      push.send.mockRejectedValue(new Error('FCM down'));

      await expect(service.sendToUser(USER, { title: 'a', body: 'b' })).resolves.toBeUndefined();
    });
  });

  describe('notifyNewMessage', () => {
    it('truncates a long body rather than shipping it whole to the tray', async () => {
      devices.find!.mockResolvedValue([{ token: 'live' }] as DeviceToken[]);

      await service.notifyNewMessage(USER, 'Anvar', 'Pomidor', 'x'.repeat(500), 'chat-1');

      const [, message] = push.send.mock.calls[0];
      expect(message.body.length).toBeLessThanOrEqual(140);
      expect(message.body.endsWith('…')).toBe(true);
      expect(message.data).toEqual({ type: 'chat_message', chatId: 'chat-1' });
    });
  });
});
