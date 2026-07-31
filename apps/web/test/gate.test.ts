import { describe, expect, it, vi } from 'vitest';
import { ApiError, PHONE_REQUIRED, apiFetch, needsPhone } from '@/lib/api';
import { phoneGatePath } from '@/lib/session';

/**
 * The line between "verify your phone" and every other refusal.
 *
 * Getting this wrong is silent in both directions: too loose and an ordinary
 * "this listing is not yours" error drops somebody into an SMS flow they do
 * not need; too strict and the gate's 403 surfaces as a raw error message and
 * the person has no way forward at all.
 */
describe('reading the API refusal', () => {
  /** `apiFetch` rejects; this is the thrown value, typed. */
  const rejection = async (call: Promise<unknown>): Promise<ApiError> => {
    try {
      await call;
    } catch (error) {
      return error as ApiError;
    }
    throw new Error('expected the request to fail');
  };

  const respondWith = (status: number, payload: unknown) =>
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status,
        json: async () => payload,
      })),
    );

  it('carries the machine-readable code off the envelope', async () => {
    respondWith(403, { error: PHONE_REQUIRED, message: 'Telefon raqamni tasdiqlang' });

    const error = await rejection(apiFetch('/listings', { method: 'POST' }));

    expect(error).toBeInstanceOf(ApiError);
    expect(error.code).toBe(PHONE_REQUIRED);
    // The Uzbek message still reaches the user; the code is for the code.
    expect(error.message).toBe('Telefon raqamni tasdiqlang');
    expect(needsPhone(error)).toBe(true);
  });

  it('does not mistake an ordinary 403 for the gate', async () => {
    respondWith(403, { message: 'Bu e’lon sizniki emas' });

    const error = await rejection(apiFetch('/listings/x', { method: 'PATCH' }));

    // Matching on the Uzbek prose would break the first time somebody rewords
    // it, and would send the owner of a listing to the SMS screen.
    expect(needsPhone(error)).toBe(false);
    expect(error.message).toBe('Bu e’lon sizniki emas');
  });

  it('does not mistake a thrown non-ApiError for the gate', () => {
    expect(needsPhone(new Error('boom'))).toBe(false);
    expect(needsPhone(null)).toBe(false);
  });

  it('falls back to a readable message when the body has none', async () => {
    respondWith(500, null);

    const error = await rejection(apiFetch('/listings'));

    expect(error.message).toContain('Serverda xatolik');
    expect(error.code).toBeUndefined();
  });

  it('takes the first message when validation returns a list', async () => {
    respondWith(400, { message: ['Hajmni kiriting', 'Narxni kiriting'] });

    const error = await rejection(apiFetch('/listings', { method: 'POST' }));

    expect(error.message).toBe('Hajmni kiriting');
  });
});

describe('where the gate sends people', () => {
  it('carries the page they were on', () => {
    expect(phoneGatePath('/e/abc-123')).toBe('/telefon?next=%2Fe%2Fabc-123');
  });

  it('refuses an absolute URL', () => {
    // `next` is attacker-supplied in every entry point that reads a query
    // string; without this the verification screen becomes an open redirect.
    expect(phoneGatePath('https://evil.example/steal')).toBe('/telefon?next=%2F');
  });

  it('refuses a protocol-relative URL', () => {
    // The one that slips past a naive "starts with /" check.
    expect(phoneGatePath('//evil.example/steal')).toBe('/telefon?next=%2F');
  });
});
