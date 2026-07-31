/** Injection token — callers depend on the interface, never on a concrete provider. */
export const PUSH_SERVICE = Symbol('PUSH_SERVICE');

export interface PushMessage {
  title: string;
  body: string;
  /** Deep-link payload. FCM only carries strings, so everything is stringified. */
  data?: Record<string, string>;
}

export interface PushResult {
  sent: number;
  /**
   * Tokens the provider rejected as permanently dead (app uninstalled, token
   * rotated). The caller deletes them — a token FCM has retired never revives,
   * and keeping it costs a wasted request on every future notification.
   */
  invalidTokens: string[];
}

export interface PushService {
  /**
   * Delivers one message to many tokens. Implementations must not throw on a
   * provider-side failure: a push that cannot be delivered may never fail the
   * user action that triggered it.
   */
  send(tokens: string[], message: PushMessage): Promise<PushResult>;
}
