'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { formatPhone } from '@/lib/format';
import { t } from '@/lib/strings';
import { type AuthState, confirmCode, sendCode } from './actions';

const INITIAL: AuthState = { step: 'phone' };

export function LoginForm({ next, devMode }: { next: string; devMode: boolean }) {
  const [phoneState, submitPhone] = useActionState(sendCode, INITIAL);
  const [codeState, submitCode] = useActionState(confirmCode, INITIAL);

  // Once a code has been sent, the code step owns the screen.
  const onCodeStep = phoneState.step === 'code';
  const phone = codeState.phone ?? phoneState.phone ?? '';
  const error = onCodeStep ? codeState.error : phoneState.error;

  return (
    <div className="mx-auto w-full max-w-sm">
      <h1 className="text-2xl">{onCodeStep ? t.auth.codeTitle : t.auth.title}</h1>
      <p className="mt-1.5 text-sm text-ink-muted">
        {onCodeStep ? (
          <>
            <span className="numeric font-medium text-ink">{formatPhone(phone)}</span>{' '}
            {t.auth.codeSubtitle}
          </>
        ) : (
          t.auth.subtitle
        )}
      </p>

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-lg bg-danger/10 px-3 py-2 text-sm font-medium text-danger"
        >
          {error}
        </p>
      )}

      {onCodeStep ? (
        <form action={submitCode} className="mt-6 space-y-4">
          <input type="hidden" name="phone" value={phone} />
          <input type="hidden" name="next" value={next} />
          <CodeInput />
          {devMode && <p className="text-xs text-ink-faint">{t.auth.devHint}</p>}
          <SubmitButton label={t.auth.finish} />
        </form>
      ) : (
        <form action={submitPhone} className="mt-6 space-y-4">
          <PhoneInput defaultValue={phoneState.phone} />
          <SubmitButton label={t.auth.continue} />
        </form>
      )}
    </div>
  );
}

/**
 * The +998 prefix is fixed and outside the field. It is the same for every user
 * in the country, and leaving it editable invites half-typed numbers.
 */
function PhoneInput({ defaultValue }: { defaultValue?: string }) {
  const [value, setValue] = useState(defaultValue?.replace('+998', '') ?? '');

  const onChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setValue(event.target.value.replace(/\D/g, '').slice(0, 9));
  };

  return (
    <div>
      <label htmlFor="phone" className="mb-1.5 block text-sm font-medium text-ink">
        {t.auth.phoneLabel}
      </label>
      <div className="flex items-stretch overflow-hidden rounded-lg bg-surface ring-1 ring-hairline focus-within:ring-2 focus-within:ring-turquoise">
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
function CodeInput() {
  const [digits, setDigits] = useState<string[]>(Array(6).fill(''));
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    refs.current[0]?.focus();
  }, []);

  const write = (index: number, raw: string) => {
    const clean = raw.replace(/\D/g, '');
    if (!clean) {
      setDigits((prev) => prev.map((d, i) => (i === index ? '' : d)));
      return;
    }

    setDigits((prev) => {
      const next = [...prev];
      // A pasted code fills forward from the box it landed in.
      for (let i = 0; i < clean.length && index + i < 6; i += 1) {
        next[index + i] = clean[i];
      }
      return next;
    });

    const landing = Math.min(index + clean.length, 5);
    refs.current[landing]?.focus();
  };

  const onKeyDown = (index: number) => (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace' && !digits[index] && index > 0) {
      refs.current[index - 1]?.focus();
    }
  };

  return (
    <div>
      <span className="mb-1.5 block text-sm font-medium text-ink">SMS kod</span>
      <div className="flex gap-2" role="group" aria-label="SMS kod">
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
            className="numeric h-14 w-full rounded-lg bg-surface text-center text-xl font-bold text-ink ring-1 ring-hairline outline-none focus:ring-2 focus:ring-turquoise"
          />
        ))}
      </div>
      <input type="hidden" name="code" value={digits.join('')} />
    </div>
  );
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="tap-target w-full rounded-lg bg-saffron px-4 py-3 text-base font-semibold text-white transition-colors hover:bg-saffron-dark disabled:opacity-60"
    >
      {pending ? t.common.loading : label}
    </button>
  );
}
