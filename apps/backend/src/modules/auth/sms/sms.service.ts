/** Injection token — modules depend on the interface, never on a concrete provider. */
export const SMS_SERVICE = Symbol('SMS_SERVICE');

export interface SmsService {
  /**
   * Sends one SMS. Implementations must not throw on a provider-side rejection
   * that the user could cause (bad number); they return false so the caller can
   * answer with an Uzbek message instead of a 500.
   */
  send(phone: string, text: string): Promise<boolean>;
}
