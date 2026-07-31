import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { of, throwError } from 'rxjs';
import { EskizSmsService } from './eskiz-sms.service';

/**
 * Reading Eskiz's answer.
 *
 * The dangerous case is not an error — it is a success that is not one. Eskiz
 * answers HTTP 200 to a message it will never deliver, most often because the
 * text has not been through moderation. Believing the status code means telling
 * a farmer "code sent", logging nothing, and finding out from a support call.
 */
const SETTINGS = {
  provider: 'eskiz',
  eskizEmail: 'a@b.uz',
  eskizPassword: 'secret',
  eskizBaseUrl: 'https://notify.eskiz.uz/api',
  eskizFrom: '4546',
};

describe('EskizSmsService', () => {
  let service: EskizSmsService;
  let post: jest.Mock;

  const loginOk = () => of({ status: 200, data: { data: { token: 'tok' } } });

  beforeEach(async () => {
    post = jest.fn();

    const moduleRef = await Test.createTestingModule({
      providers: [
        EskizSmsService,
        { provide: HttpService, useValue: { post } },
        { provide: ConfigService, useValue: { getOrThrow: () => SETTINGS } },
      ],
    }).compile();

    service = moduleRef.get(EskizSmsService);
  });

  /** First call is the login, second is the send. */
  const stub = (sendResponse: unknown) => {
    post.mockImplementationOnce(loginOk).mockImplementationOnce(() => of(sendResponse));
  };

  it('sends the number as a bare MSISDN', async () => {
    stub({ status: 200, data: { status: 'waiting' } });

    await service.send('+998901234567', 'Salom');

    // Eskiz rejects the +998 display form.
    expect(post.mock.calls[1][1]).toMatchObject({ mobile_phone: '998901234567' });
  });

  it('accepts a message Eskiz has queued', async () => {
    stub({ status: 200, data: { id: '1', status: 'waiting', message: 'Waiting' } });

    await expect(service.send('+998901234567', 'Salom')).resolves.toBe(true);
  });

  it('refuses a message Eskiz rejected, even on a 200', async () => {
    stub({ status: 200, data: { status: 'rejected', message: 'Message not moderated' } });

    // This is the moderation failure. Returning true here is what turns it into
    // a silent one — the OTP channel throws on false so the dispatcher can fall
    // through to Telegram instead of promising an SMS that will never arrive.
    await expect(service.send('+998901234567', 'Salom')).resolves.toBe(false);
  });

  it('treats an unfamiliar body as sent rather than blocking every login', async () => {
    stub({ status: 200, data: { id: '1', state: 'something-new' } });

    // A shape we have not seen must not take the whole sign-in flow down. It is
    // logged in full instead, so it is visible without being fatal.
    await expect(service.send('+998901234567', 'Salom')).resolves.toBe(true);
  });

  it('refuses a non-2xx', async () => {
    stub({ status: 500, data: {} });

    await expect(service.send('+998901234567', 'Salom')).resolves.toBe(false);
  });

  it('logs in once for a burst of messages', async () => {
    // An advertisement produces exactly this burst. Eskiz rate-limits its login
    // endpoint, so one login per request means no codes at all on launch day.
    post.mockImplementationOnce(loginOk);
    post.mockImplementation(() => of({ status: 200, data: { status: 'waiting' } }));

    await Promise.all(
      Array.from({ length: 10 }, () => service.send('+998901234567', 'Salom')),
    );

    const logins = post.mock.calls.filter(([url]) => String(url).endsWith('/auth/login'));
    expect(logins).toHaveLength(1);
  });

  it('re-authenticates once when the token has expired', async () => {
    const unauthorized = { response: { status: 401 } };
    post
      .mockImplementationOnce(loginOk)
      .mockImplementationOnce(() => throwError(() => unauthorized))
      .mockImplementationOnce(loginOk)
      .mockImplementationOnce(() => of({ status: 200, data: { status: 'waiting' } }));

    await expect(service.send('+998901234567', 'Salom')).resolves.toBe(true);
    expect(post.mock.calls.filter(([url]) => String(url).endsWith('/auth/login'))).toHaveLength(2);
  });

  it('gives up rather than throwing when Eskiz is unreachable', async () => {
    post.mockImplementation(() => throwError(() => new Error('ECONNREFUSED')));

    // A provider outage must not turn into a 500 on the sign-in endpoint.
    await expect(service.send('+998901234567', 'Salom')).resolves.toBe(false);
  });
});
