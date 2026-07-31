import { classify, explain } from './gateway-errors';

/**
 * Two failures that look identical and mean opposite things.
 *
 * "This number has no Telegram" is routine — the person gets an SMS instead and
 * nobody needs to know. "Our account has no balance" means the channel is dead
 * for everybody, every code is being paid for twice over on SMS, and if SMS is
 * not configured nobody can sign in at all.
 *
 * Both arrive from `checkSendAbility` in the same shape. This is the only thing
 * standing between them.
 */
describe('classify', () => {
  it('calls an empty balance an account problem', () => {
    // Found by running the real token against the real API: an account with no
    // credit answers this to every number, including reachable ones.
    expect(classify('BALANCE_NOT_ENOUGH')).toBe('account');
  });

  it('calls a bad token a configuration problem', () => {
    expect(classify('ACCESS_TOKEN_INVALID')).toBe('config');
  });

  it('calls an unverified sender a configuration problem', () => {
    expect(classify('SENDER_NOT_OWNED')).toBe('config');
  });

  it('calls a number with no Telegram unreachable', () => {
    expect(classify('PHONE_NUMBER_NOT_FOUND')).toBe('unreachable');
  });

  it('is case-insensitive', () => {
    expect(classify('balance_not_enough')).toBe('account');
  });

  it('does not guess at an error it has never seen', () => {
    // Telegram may add codes. Calling an unknown one "unreachable" would file
    // a future outage under routine and hide it.
    expect(classify('SOMETHING_NEW')).toBe('unknown');
    expect(classify(undefined)).toBe('unknown');
  });
});

describe('explain', () => {
  it('tells an operator to top the account up', () => {
    const message = explain('account', 'BALANCE_NOT_ENOUGH');

    // The log line has to name the fix, not just the fault — it is read at
    // midnight by somebody who did not write this code.
    expect(message).toContain('balans');
    expect(message).toContain('gateway.telegram.org');
  });

  it('names the error code in every case, so the log can be searched', () => {
    for (const fault of ['account', 'config', 'input', 'unreachable', 'unknown'] as const) {
      expect(explain(fault, 'SOME_CODE')).toContain('SOME_CODE');
    }
  });
});
