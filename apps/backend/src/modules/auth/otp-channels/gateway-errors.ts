/**
 * Telling "this person has no Telegram" apart from "our account is empty".
 *
 * Both come back from the same call, both make the code fall through to SMS,
 * and they need opposite responses: the first is normal and costs us an SMS,
 * the second means the channel is dead for *everybody* and somebody has to top
 * the account up. Logged the same way, the second hides inside the noise of the
 * first until the SMS bill arrives — or until SMS is not configured either and
 * nobody can sign in at all.
 *
 * Found by running the real token against the real API: an account with no
 * balance answers `BALANCE_NOT_ENOUGH` to `checkSendAbility`, which reads
 * exactly like an unreachable number unless you look at the code.
 */
export type GatewayFault = 'unreachable' | 'account' | 'config' | 'input' | 'unknown';

const FAULTS: Record<string, GatewayFault> = {
  // Ours to fix, and urgent: nothing is going out until it is.
  BALANCE_NOT_ENOUGH: 'account',

  // Ours to fix, and it means the channel never worked.
  ACCESS_TOKEN_INVALID: 'config',
  ACCESS_TOKEN_REQUIRED: 'config',
  SENDER_NOT_OWNED: 'config',
  SENDER_NOT_VERIFIED: 'config',
  SENDER_USERNAME_INVALID: 'config',

  // Normal. This person is reached by SMS instead.
  PHONE_NUMBER_NOT_FOUND: 'unreachable',
  USER_NOT_FOUND: 'unreachable',
  PHONE_NUMBER_BLOCKED: 'unreachable',
  REQUEST_NOT_ALLOWED: 'unreachable',

  // A caller sent something malformed — a bug on our side, not an outage.
  PHONE_NUMBER_INVALID: 'input',
  CODE_INVALID: 'input',
  TTL_INVALID: 'input',
};

export const classify = (error: string | undefined): GatewayFault =>
  FAULTS[String(error ?? '').toUpperCase()] ?? 'unknown';

/** What to tell an operator reading the log at midnight. */
export const explain = (fault: GatewayFault, error: string | undefined): string => {
  switch (fault) {
    case 'account':
      return `Telegram Gateway balansi tugagan (${error}). Kodlar SMS orqali ketmoqda — gateway.telegram.org da balansni to‘ldiring.`;
    case 'config':
      return `Telegram Gateway sozlamasi noto‘g‘ri (${error}). Kanal hech kimga yetkazmayapti.`;
    case 'input':
      return `Telegram Gateway so‘rovni rad etdi (${error}). Bu bizning tomonimizdagi xato.`;
    case 'unreachable':
      return `Telegramda topilmadi (${error}).`;
    default:
      return `Telegram Gateway kutilmagan javob qaytardi (${error}).`;
  }
};
