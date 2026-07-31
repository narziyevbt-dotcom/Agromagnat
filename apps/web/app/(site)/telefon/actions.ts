'use server';

import { redirect } from 'next/navigation';
import { ApiError, confirmPhoneCode, requestPhoneCode } from '@/lib/api';
import { getAccessToken, setSession } from '@/lib/session';

export interface VerifyState {
  step: 'phone' | 'code';
  phone?: string;
  error?: string;
  expiresIn?: number;
}

function safeNext(next: FormDataEntryValue | null): string {
  const value = typeof next === 'string' ? next : '';
  return value.startsWith('/') && !value.startsWith('//') ? value : '/';
}

function isRedirectSignal(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'digest' in error &&
    String((error as { digest?: unknown }).digest).startsWith('NEXT_REDIRECT')
  );
}

const asMessage = (error: unknown, fallback: string): string =>
  error instanceof ApiError ? error.message : fallback;

export async function sendVerifyCode(
  _prev: VerifyState,
  formData: FormData,
): Promise<VerifyState> {
  const token = await getAccessToken();
  if (!token) {
    redirect('/kirish?next=/telefon');
  }

  const raw = String(formData.get('phone') ?? '');
  const digits = raw.replace(/\D/g, '');
  const phone = digits ? `+${digits}` : '';

  if (!/^\+998\d{9}$/.test(phone)) {
    return { step: 'phone', error: "Telefon raqamini to'liq kiriting: +998 XX XXX-XX-XX" };
  }

  try {
    const result = await requestPhoneCode(phone, token);
    return { step: 'code', phone, expiresIn: result.expiresIn };
  } catch (error) {
    return {
      step: 'phone',
      phone,
      error: asMessage(error, "SMS yuborilmadi. Qayta urinib ko'ring"),
    };
  }
}

export async function resendVerifyCode(phone: string): Promise<VerifyState> {
  const token = await getAccessToken();
  if (!token) {
    redirect('/kirish?next=/telefon');
  }

  try {
    const result = await requestPhoneCode(phone, token);
    return { step: 'code', phone, expiresIn: result.expiresIn };
  } catch (error) {
    return {
      step: 'code',
      phone,
      error: asMessage(error, "SMS yuborilmadi. Qayta urinib ko'ring"),
    };
  }
}

/**
 * Confirms the code and replaces the session.
 *
 * The new pair is the point. `phoneVerified` rides in the access token so the
 * gate costs no database round trip, which means the token in the cookie right
 * now still says "unverified" — keeping it would leave the person staring at
 * the same refusal they just cleared, for up to fifteen minutes.
 */
export async function confirmVerifyCode(
  _prev: VerifyState,
  formData: FormData,
): Promise<VerifyState> {
  const token = await getAccessToken();
  if (!token) {
    redirect('/kirish?next=/telefon');
  }

  const phone = String(formData.get('phone') ?? '');
  const code = String(formData.get('code') ?? '').replace(/\D/g, '');
  const next = safeNext(formData.get('next'));

  if (code.length !== 6) {
    return { step: 'code', phone, error: "Kod 6 ta raqamdan iborat bo'lishi kerak" };
  }

  try {
    const tokens = await confirmPhoneCode(phone, code, token);
    await setSession(tokens.accessToken, tokens.refreshToken);
  } catch (error) {
    if (isRedirectSignal(error)) {
      throw error;
    }
    return { step: 'code', phone, error: asMessage(error, 'Kod tasdiqlanmadi') };
  }

  redirect(next);
}
