import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CodeField, PhoneField, ResendTimer } from '@/components/auth/fields';

/**
 * The code screen is where sign-ups are lost.
 *
 * Every behaviour here — auto-advance, paste, auto-submit, the resend timer —
 * exists because the alternative is a farmer on a weak signal giving up. They
 * are also the kind of interaction that breaks silently under a refactor and
 * that nobody notices until conversion drops.
 */

describe('PhoneField', () => {
  it('submits the number with the +998 the user never typed', async () => {
    render(
      <form>
        <PhoneField />
      </form>,
    );

    await userEvent.type(screen.getByLabelText(/telefon raqam/i), '901234567');

    const hidden = document.querySelector('input[name="phone"]') as HTMLInputElement;
    expect(hidden.value).toBe('+998901234567');
  });

  it('ignores letters and punctuation', async () => {
    render(
      <form>
        <PhoneField />
      </form>,
    );

    await userEvent.type(screen.getByLabelText(/telefon raqam/i), '90-123 45 67abc');

    const hidden = document.querySelector('input[name="phone"]') as HTMLInputElement;
    expect(hidden.value).toBe('+998901234567');
  });

  it('stops at nine digits', async () => {
    render(
      <form>
        <PhoneField />
      </form>,
    );

    await userEvent.type(screen.getByLabelText(/telefon raqam/i), '9012345678888');

    const hidden = document.querySelector('input[name="phone"]') as HTMLInputElement;
    expect(hidden.value).toBe('+998901234567');
  });
});

describe('CodeField', () => {
  const renderInForm = () => {
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <CodeField />
      </form>,
    );
    const hidden = () => (document.querySelector('input[name="code"]') as HTMLInputElement).value;
    return { onSubmit, hidden };
  };

  it('advances a box at a time and assembles one value', async () => {
    const { hidden } = renderInForm();

    await userEvent.keyboard('123456');

    expect(hidden()).toBe('123456');
  });

  it('submits itself once the sixth digit lands', async () => {
    const { onSubmit } = renderInForm();

    await userEvent.keyboard('123456');

    // The sixth digit is the whole intent. Asking for a second tap on "Tayyor"
    // after it is friction every other OTP screen has already removed.
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it('submits the whole code, not the code as it was one keystroke ago', async () => {
    // The bug this exists for: submitting from the change handler sent the
    // value React had not written to the DOM yet, so a correct code arrived
    // five digits long and the screen answered "the code must be 6 digits".
    // Nobody could sign in, and the older assertion above still passed —
    // `onSubmit` *was* called, just with the wrong payload.
    let submittedCode: string | null = null;
    render(
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submittedCode = String(new FormData(event.currentTarget).get('code'));
        }}
      >
        <CodeField />
      </form>,
    );

    await userEvent.keyboard('123456');

    expect(submittedCode).toBe('123456');
  });

  it('submits the whole code when it is pasted', async () => {
    let submittedCode: string | null = null;
    render(
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submittedCode = String(new FormData(event.currentTarget).get('code'));
        }}
      >
        <CodeField />
      </form>,
    );

    await userEvent.paste('654321');

    expect(submittedCode).toBe('654321');
  });

  it('does not submit early', async () => {
    const { onSubmit } = renderInForm();

    await userEvent.keyboard('12345');

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('fills every box from a pasted code', async () => {
    const { hidden, onSubmit } = renderInForm();

    // The code arrives by SMS, so pasting it is the common path, not the rare
    // one — and a paste lands entirely in the first box.
    await userEvent.paste('654321');

    expect(hidden()).toBe('654321');
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it('ignores the surrounding text when the whole SMS is pasted', async () => {
    const { hidden } = renderInForm();

    await userEvent.paste('112233');

    expect(hidden()).toBe('112233');
  });

  it('steps back on backspace so a wrong digit can be fixed', async () => {
    const { hidden } = renderInForm();

    await userEvent.keyboard('123');
    await userEvent.keyboard('{Backspace}{Backspace}');

    expect(hidden()).toBe('12');
  });

  it('lets a corrected code submit again after a failed attempt', async () => {
    const { onSubmit } = renderInForm();

    await userEvent.keyboard('123456');
    expect(onSubmit).toHaveBeenCalledOnce();

    // Wrong code: the person backspaces and retypes. Without releasing the
    // submit guard the corrected code would never be sent.
    await userEvent.keyboard('{Backspace}{Backspace}9');

    expect(onSubmit).toHaveBeenCalledTimes(2);
  });
});

describe('ResendTimer', () => {
  /**
   * One second at a time, each flushed on its own.
   *
   * The countdown schedules the next tick from an effect that only runs after
   * the previous tick has rendered, so jumping the clock in one go fires
   * exactly one timeout and the timer appears stuck.
   */
  const tick = (seconds: number) => {
    for (let i = 0; i < seconds; i += 1) {
      act(() => {
        vi.advanceTimersByTime(1000);
      });
    }
  };

  it('counts down before offering a resend', () => {
    vi.useFakeTimers();
    try {
      render(<ResendTimer seconds={3} onResend={vi.fn()} />);

      expect(screen.queryByRole('button')).not.toBeInTheDocument();

      tick(3);

      // Without this the only recourse for a code that never arrived is a page
      // reload, and on this market's connections that case is common.
      expect(screen.getByRole('button')).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('restarts when a new code is sent', () => {
    vi.useFakeTimers();
    try {
      const { rerender } = render(<ResendTimer seconds={1} onResend={vi.fn()} />);
      tick(1);
      expect(screen.getByRole('button')).toBeInTheDocument();

      rerender(<ResendTimer seconds={60} onResend={vi.fn()} />);

      // A resend that left the button live would let somebody tap it again
      // straight away and burn the three-per-ten-minutes budget in one go.
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
