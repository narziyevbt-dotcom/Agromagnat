'use client';

import { useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { t } from '@/lib/strings';

/**
 * The pieces every code screen is made of.
 *
 * Signing in and attaching a phone to a Google account ask for exactly the same
 * two things in the same order, so they share these rather than each growing
 * their own copy — a fix to the paste handling has to land in one place.
 */

/**
 * The +998 prefix is fixed and outside the field. It is the same for every user
 * in the country, and leaving it editable invites half-typed numbers.
 */
export function PhoneField({ defaultValue }: { defaultValue?: string }) {
  const [value, setValue] = useState(defaultValue?.replace('+998', '') ?? '');

  const onChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setValue(event.target.value.replace(/\D/g, '').slice(0, 9));
  };

  return (
    <div>
      <label htmlFor="phone" className="mb-1.5 block text-sm font-medium text-ink">
        {t.auth.phoneLabel}
      </label>
      <div className="flex items-stretch overflow-hidden rounded-lg bg-surface ring-1 ring-hairline transition-shadow focus-within:ring-2 focus-within:ring-turquoise">
        <span className="numeric flex items-center border-r border-hairline px-3 text-ink-muted">
          +998
        </span>
        {/* Unnamed on purpose — the hidden field below is what gets submitted,
            carrying the +998 prefix the user never has to type. */}
        <input
          id="phone"
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          autoFocus
          required
          value={value}
          onChange={onChange}
          placeholder="90 123 45 67"
          className="numeric tap-target min-w-0 flex-1 bg-transparent px-3 text-lg tracking-wide outline-none"
        />
      </div>
      <input type="hidden" name="phone" value={value ? `+998${value}` : ''} />
    </div>
  );
}

/** Six boxes that behave like one field: auto-advance, paste, backspace. */
export function CodeField() {
  const [digits, setDigits] = useState<string[]>(Array(6).fill(''));
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const submitted = useRef(false);

  useEffect(() => {
    refs.current[0]?.focus();
  }, []);

  const write = (index: number, raw: string) => {
    const clean = raw.replace(/\D/g, '');
    if (!clean) {
      setDigits(digits.map((digit, i) => (i === index ? '' : digit)));
      submitted.current = false;
      return;
    }

    // Built here rather than inside a state updater. React does not run the
    // updater when `setState` is called — it runs it during the next render —
    // so reading the result back out of one gives an empty array, and
    // `[].every(Boolean)` is `true`. That submitted the form on the first
    // keystroke with a one-digit code.
    const next = [...digits];
    // A pasted code fills forward from the box it landed in.
    for (let i = 0; i < clean.length && index + i < 6; i += 1) {
      next[index + i] = clean[i];
    }
    setDigits(next);

    const landing = Math.min(index + clean.length, 5);
    refs.current[landing]?.focus();

    // The sixth digit is the whole intent — asking for a second tap on
    // "Tayyor" after it is pure friction, and it is what every OTP screen
    // people already use does. Guarded so a correction after a failed attempt
    // does not fire a second submit while the first is still in flight.
    if (next.every(Boolean) && !submitted.current) {
      submitted.current = true;
      refs.current[landing]?.form?.requestSubmit();
    }
  };

  const onKeyDown = (index: number) => (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace' && !digits[index] && index > 0) {
      refs.current[index - 1]?.focus();
    }
  };

  return (
    <div>
      <span className="mb-1.5 block text-sm font-medium text-ink">{t.auth.codeLabel}</span>
      <div className="flex gap-2" role="group" aria-label={t.auth.codeLabel}>
        {digits.map((digit, index) => (
          <input
            key={index}
            ref={(element) => {
              refs.current[index] = element;
            }}
            type="text"
            inputMode="numeric"
            autoComplete={index === 0 ? 'one-time-code' : 'off'}
            maxLength={6}
            value={digit}
            aria-label={`${index + 1}-raqam`}
            onChange={(event) => write(index, event.target.value)}
            onKeyDown={onKeyDown(index)}
            className="numeric h-14 w-full rounded-lg bg-surface text-center text-xl font-bold text-ink ring-1 ring-hairline outline-none transition-shadow focus:ring-2 focus:ring-turquoise"
          />
        ))}
      </div>
      <input type="hidden" name="code" value={digits.join('')} />
    </div>
  );
}

export function AuthSubmit({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="tap-target flex w-full items-center justify-center gap-2 rounded-lg bg-lime px-4 py-3 text-base font-semibold text-forest transition-colors hover:bg-lime-dark disabled:opacity-60"
    >
      {pending && <Spinner />}
      {pending ? t.common.loading : label}
    </button>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="h-4 w-4 animate-spin rounded-full border-2 border-forest/30 border-t-forest"
    />
  );
}

/**
 * Counts the code down and then offers to send another.
 *
 * Without it the only recourse for a code that never arrived is a page reload,
 * and a farmer on a weak signal hits that case often enough that it decides
 * whether they finish signing in at all.
 */
export function ResendTimer({
  seconds,
  onResend,
}: {
  seconds: number;
  onResend: () => void;
}) {
  const [left, setLeft] = useState(seconds);

  useEffect(() => {
    setLeft(seconds);
  }, [seconds]);

  useEffect(() => {
    if (left <= 0) return;
    const timer = setTimeout(() => setLeft((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [left]);

  if (left > 0) {
    return (
      <p className="text-center text-sm text-ink-faint" aria-live="off">
        {t.auth.resendIn} <span className="numeric">{left}</span> s
      </p>
    );
  }

  return (
    <button
      type="button"
      onClick={onResend}
      className="tap-target w-full text-center text-sm font-medium text-turquoise hover:underline"
    >
      {t.auth.resend}
    </button>
  );
}
