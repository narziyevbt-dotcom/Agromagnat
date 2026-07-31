'use server';

import { redirect } from 'next/navigation';
import { ApiError, requestOtp, verifyOtp } from '@/lib/api';
import { setSession } from '@/lib/session';

export interface AuthState {
  step: 'phone' | 'code';
  phone?: string;
  error?: string;
  /** Seconds until the code expires — drives the resend timer. */
  expiresIn?: number;
}

/** Only ever redirect within this site; an open redirect here is a phishing tool. */
function safeNext(next: FormDataEntryValue | null): string {
  const value = typeof next === 'string' ? next : '';
  return value.startsWith('/') && !value.startsWith('//') ? value : '/';
}

/** Next signals a redirect by throwing; that must not be reported as failure. */
function isRedirectSignal(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'digest' in error &&
    String((error as { digest?: unknown }).digest).startsWith('NEXT_REDIRECT')
  );
}

export async function sendCode(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const raw = String(formData.get('phone') ?? '');
  const digits = raw.replace(/\D/g, '');
  const phone = digits ? `+${digits}` : '';

  if (!/^\+998\d{9}$/.test(phone)) {
    return {
      step: 'phone',
      error: "Telefon raqamini to'liq kiriting: +998 XX XXX-XX-XX",
    };
  }

  try {
    const result = await requestOtp(phone);
    return { step: 'code', phone, expiresIn: result.expiresIn };
  } catch (error) {
    return {
      step: 'phone',
      phone,
      error:
        error instanceof ApiError ? error.message : "SMS yuborilmadi. Qayta urinib ko'ring",
    };
  }
}

export async function confirmCode(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const phone = String(formData.get('phone') ?? '');
  const code = String(formData.get('code') ?? '').replace(/\D/g, '');
  const name = String(formData.get('name') ?? '').trim();
  const next = safeNext(formData.get('next'));

  if (code.length !== 6) {
    return { step: 'code', phone, error: "Kod 6 ta raqamdan iborat bo'lishi kerak" };
  }

  let destination = next;

  try {
    const tokens = await verifyOtp(phone, code, name || undefined);
    await setSession(tokens.accessToken, tokens.refreshToken);
    // A brand-new account has no name yet, so send it to the profile first.
    destination = tokens.isNewUser && !name ? '/profil' : next;
  } catch (error) {
    if (isRedirectSignal(error)) {
      throw error;
    }
    return {
      step: 'code',
      phone,
      error: error instanceof ApiError ? error.message : 'Kod tasdiqlanmadi',
    };
  }

  // Outside the try so the redirect signal is never caught by it.
  redirect(destination);
}
