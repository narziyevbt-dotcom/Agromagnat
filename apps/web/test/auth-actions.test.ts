import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api';

/**
 * The server actions behind the sign-in screen and the verification screen.
 *
 * They are where the two rules that matter live: a session is only ever stored
 * after the API says the proof was good, and a redirect only ever goes to a
 * path on this site. Both are the kind of thing that keeps working visibly
 * while being subtly wrong, which is exactly what a test is for.
 */

const api = vi.hoisted(() => ({
  requestOtp: vi.fn(),
  verifyOtp: vi.fn(),
  signInWithGoogle: vi.fn(),
  requestPhoneCode: vi.fn(),
  confirmPhoneCode: vi.fn(),
}));

const session = vi.hoisted(() => ({
  setSession: vi.fn(),
  // Typed to include `undefined` so a test can play the signed-out case.
  getAccessToken: vi.fn<() => Promise<string | undefined>>(),
}));

/** Stands in for Next's redirect, which signals by throwing. */
class RedirectSignal extends Error {
  digest: string;
  constructor(readonly to: string) {
    super(`NEXT_REDIRECT to ${to}`);
    this.digest = `NEXT_REDIRECT;replace;${to}`;
  }
}

vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    throw new RedirectSignal(to);
  },
}));

vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  ...api,
}));

vi.mock('@/lib/session', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/session')>()),
  ...session,
}));

const { confirmCode, googleSignInAction, resendCode, sendCode } = await import(
  '@/app/(site)/kirish/actions'
);
const { confirmVerifyCode, sendVerifyCode } = await import('@/app/(site)/telefon/actions');

const form = (fields: Record<string, string>): FormData => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.append(key, value);
  return data;
};

/** Runs an action that is expected to redirect and reports where to. */
const redirectedTo = async (run: () => Promise<unknown>): Promise<string> => {
  try {
    await run();
  } catch (error) {
    if (error instanceof RedirectSignal) return error.to;
    throw error;
  }
  throw new Error('expected a redirect, got a plain return');
};

beforeEach(() => {
  vi.clearAllMocks();
  session.getAccessToken.mockResolvedValue('access-token');
});

describe('sendCode', () => {
  it('normalises a number typed with spaces and dashes', async () => {
    api.requestOtp.mockResolvedValue({ sent: true, expiresIn: 300 });

    const state = await sendCode({ step: 'phone' }, form({ phone: '+998 90 123-45-67' }));

    // People type their number the way it is written on a signboard.
    expect(api.requestOtp).toHaveBeenCalledWith('+998901234567');
    expect(state).toMatchObject({ step: 'code', expiresIn: 300 });
  });

  it('refuses a short number without spending an SMS', async () => {
    const state = await sendCode({ step: 'phone' }, form({ phone: '+99890123' }));

    expect(api.requestOtp).not.toHaveBeenCalled();
    expect(state.step).toBe('phone');
    expect(state.error).toContain('+998');
  });

  it('refuses a foreign number', async () => {
    const state = await sendCode({ step: 'phone' }, form({ phone: '+79001234567' }));

    expect(api.requestOtp).not.toHaveBeenCalled();
    expect(state.error).toBeDefined();
  });

  it('shows the API message rather than a generic one', async () => {
    // The rate limiter's wording is the useful part: it says how long to wait.
    api.requestOtp.mockRejectedValue(new ApiError('10 daqiqadan keyin urinib ko‘ring', 429));

    const state = await sendCode({ step: 'phone' }, form({ phone: '+998901234567' }));

    expect(state).toMatchObject({ step: 'phone', error: '10 daqiqadan keyin urinib ko‘ring' });
  });
});

describe('resendCode', () => {
  it('stays on the code step when the resend is rate limited', async () => {
    api.requestOtp.mockRejectedValue(new ApiError('Juda tez-tez', 429));

    const state = await resendCode('+998901234567');

    // Dropping back to the phone step would throw away a code that may still
    // be on its way, and make the person retype a number that was correct.
    expect(state.step).toBe('code');
    expect(state.error).toBe('Juda tez-tez');
  });
});

describe('confirmCode', () => {
  it('stores the session and goes where the visitor was headed', async () => {
    api.verifyOtp.mockResolvedValue({
      accessToken: 'at',
      refreshToken: 'rt',
      isNewUser: false,
    });

    const to = await redirectedTo(() =>
      confirmCode({ step: 'code' }, form({ phone: '+998901234567', code: '000000', next: '/joylash' })),
    );

    expect(session.setSession).toHaveBeenCalledWith('at', 'rt');
    expect(to).toBe('/joylash');
  });

  it('sends a brand-new account to fill in its name first', async () => {
    api.verifyOtp.mockResolvedValue({ accessToken: 'at', refreshToken: 'rt', isNewUser: true });

    const to = await redirectedTo(() =>
      confirmCode({ step: 'code' }, form({ phone: '+998901234567', code: '000000', next: '/qidiruv' })),
    );

    expect(to).toBe('/profil');
  });

  it('refuses to redirect off-site', async () => {
    api.verifyOtp.mockResolvedValue({ accessToken: 'at', refreshToken: 'rt', isNewUser: false });

    const to = await redirectedTo(() =>
      confirmCode(
        { step: 'code' },
        form({ phone: '+998901234567', code: '000000', next: 'https://evil.example' }),
      ),
    );

    // `next` comes off a query string. An open redirect on the login screen is
    // a phishing tool: the link looks like ours right up to the moment it isn't.
    expect(to).toBe('/');
  });

  it('never stores a session when the code is wrong', async () => {
    api.verifyOtp.mockRejectedValue(new ApiError('Kod noto‘g‘ri', 401));

    const state = await confirmCode(
      { step: 'code' },
      form({ phone: '+998901234567', code: '111111' }),
    );

    expect(session.setSession).not.toHaveBeenCalled();
    expect(state).toMatchObject({ step: 'code', error: 'Kod noto‘g‘ri' });
  });

  it('checks the code length before the round trip', async () => {
    const state = await confirmCode({ step: 'code' }, form({ phone: '+998901234567', code: '12' }));

    expect(api.verifyOtp).not.toHaveBeenCalled();
    expect(state.error).toContain('6');
  });
});

describe('googleSignInAction', () => {
  it('stores the session and lands on the requested page', async () => {
    api.signInWithGoogle.mockResolvedValue({
      accessToken: 'at',
      refreshToken: 'rt',
      isNewUser: true,
    });

    const to = await redirectedTo(() => googleSignInAction('id-token', '/e/abc'));

    expect(api.signInWithGoogle).toHaveBeenCalledWith('id-token');
    expect(session.setSession).toHaveBeenCalledWith('at', 'rt');
    // No phone was asked for, and no SMS was spent, which is the entire point
    // of having this door at all.
    expect(api.requestOtp).not.toHaveBeenCalled();
    expect(to).toBe('/e/abc');
  });

  it('reports a rejected token instead of signing anybody in', async () => {
    api.signInWithGoogle.mockRejectedValue(new ApiError('Google tokeni yaroqsiz', 401));

    const result = await googleSignInAction('forged', '/');

    expect(session.setSession).not.toHaveBeenCalled();
    expect(result).toEqual({ error: 'Google tokeni yaroqsiz' });
  });

  it('refuses to redirect off-site', async () => {
    api.signInWithGoogle.mockResolvedValue({ accessToken: 'at', refreshToken: 'rt' });

    expect(await redirectedTo(() => googleSignInAction('id-token', '//evil.example'))).toBe('/');
  });
});

describe('attaching a phone to an existing account', () => {
  it('sends the code with the account token, not anonymously', async () => {
    api.requestPhoneCode.mockResolvedValue({ sent: true, expiresIn: 300 });

    const state = await sendVerifyCode({ step: 'phone' }, form({ phone: '+998901234567' }));

    // The anonymous endpoint would create a *second* account on that number
    // instead of attaching it to the one already signed in.
    expect(api.requestPhoneCode).toHaveBeenCalledWith('+998901234567', 'access-token');
    expect(api.requestOtp).not.toHaveBeenCalled();
    expect(state.step).toBe('code');
  });

  it('replaces the session so the freshly unblocked button works now', async () => {
    api.confirmPhoneCode.mockResolvedValue({ accessToken: 'new-at', refreshToken: 'new-rt' });

    const to = await redirectedTo(() =>
      confirmVerifyCode(
        { step: 'code' },
        form({ phone: '+998901234567', code: '000000', next: '/joylash' }),
      ),
    );

    // `phoneVerified` rides in the access token, so the cookie in place right
    // now still says "unverified". Keeping it would leave the person staring
    // at the refusal they just cleared for up to fifteen minutes.
    expect(session.setSession).toHaveBeenCalledWith('new-at', 'new-rt');
    expect(to).toBe('/joylash');
  });

  it('surfaces the refusal when the number belongs to somebody else', async () => {
    api.confirmPhoneCode.mockRejectedValue(
      new ApiError('Bu raqam boshqa hisobga biriktirilgan', 400),
    );

    const state = await confirmVerifyCode(
      { step: 'code' },
      form({ phone: '+998901234567', code: '000000' }),
    );

    expect(session.setSession).not.toHaveBeenCalled();
    expect(state.error).toContain('boshqa hisobga');
  });

  it('sends a signed-out visitor to sign in first', async () => {
    session.getAccessToken.mockResolvedValue(undefined);

    const to = await redirectedTo(() =>
      sendVerifyCode({ step: 'phone' }, form({ phone: '+998901234567' })),
    );

    expect(to).toBe('/kirish?next=/telefon');
  });
});
