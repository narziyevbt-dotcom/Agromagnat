'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, MessageCircleQuestion, Send, Sparkles, X } from 'lucide-react';
import type { AssistAnswer } from '@/lib/types';

interface Turn {
  role: 'user' | 'assistant';
  content: string;
}

const STARTERS = [
  "E'lon qancha muddat turadi?",
  "Rasm nechta bo'lishi mumkin?",
  'Qanday qilib ko\'proq xaridor topaman?',
];

/**
 * The help assistant, as a launcher plus a sheet.
 *
 * It answers in Uzbek about selling here, which is the question support gets:
 * not "how does the API work" but "why did my listing disappear". Sitting in
 * the corner of every signed-in page rather than on a help screen matters,
 * because the moment somebody has the question is the moment they are stuck in
 * the middle of something else.
 *
 * Positioned clear of the mobile tab bar so it never covers a nav target.
 */
export function AiHelp() {
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) bottom.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns, open]);

  const ask = async (question: string) => {
    const trimmed = question.trim();
    if (!trimmed || busy) return;

    const history = turns.slice(-6);
    setTurns((prev) => [...prev, { role: 'user', content: trimmed }]);
    setInput('');
    setBusy(true);

    try {
      const response = await fetch('/api/ai/assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: trimmed, history }),
      });
      const data = (await response.json()) as AssistAnswer & { error?: string };

      setTurns((prev) => [
        ...prev,
        {
          role: 'assistant',
          content:
            response.ok && data.answerUz
              ? data.answerUz
              : (data.error ?? "Hozir javob bera olmadim. Birozdan keyin urinib ko'ring."),
        },
      ]);
    } catch {
      setTurns((prev) => [
        ...prev,
        { role: 'assistant', content: "Internet uzildi. Qayta urinib ko'ring." },
      ]);
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="AI yordam"
        className="fixed right-4 bottom-20 z-40 flex h-12 items-center gap-2 rounded-full bg-forest pr-5 pl-3 text-sm font-bold text-lime shadow-lg transition-transform hover:scale-105 sm:bottom-6"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-lime text-forest">
          <Sparkles className="h-4 w-4" aria-hidden="true" />
        </span>
        AI yordam
      </button>
    );
  }

  return (
    <div className="fixed right-4 bottom-20 left-4 z-50 flex max-h-[70vh] flex-col overflow-hidden rounded-[var(--radius-card)] bg-surface shadow-2xl ring-1 ring-hairline sm:bottom-6 sm:left-auto sm:w-96">
      <header className="flex items-center justify-between gap-2 bg-forest px-4 py-3">
        <span className="flex items-center gap-2 text-sm font-bold text-white">
          <MessageCircleQuestion className="h-4 w-4 text-lime" aria-hidden="true" />
          AI yordam
        </span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Yopish"
          className="flex h-8 w-8 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {turns.length === 0 && (
          <>
            <p className="text-sm text-ink-muted">
              Agromagnat bo&apos;yicha savolingizni yozing — o&apos;zbekcha javob beraman.
            </p>
            <ul className="space-y-1.5">
              {STARTERS.map((starter) => (
                <li key={starter}>
                  <button
                    type="button"
                    onClick={() => ask(starter)}
                    className="w-full rounded-lg bg-canvas px-3 py-2 text-left text-sm text-forest ring-1 ring-hairline transition-colors hover:ring-harvest"
                  >
                    {starter}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        {turns.map((turn, index) => (
          <p
            key={`${turn.role}-${index}`}
            className={
              turn.role === 'user'
                ? 'ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-sm bg-harvest px-3 py-2 text-sm text-white'
                : 'w-fit max-w-[90%] rounded-2xl rounded-bl-sm bg-canvas px-3 py-2 text-sm whitespace-pre-line text-ink'
            }
          >
            {turn.content}
          </p>
        ))}

        {busy && (
          <p className="flex items-center gap-2 text-xs text-ink-faint">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            O&apos;ylayapman...
          </p>
        )}

        <div ref={bottom} />
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void ask(input);
        }}
        className="flex items-center gap-2 border-t border-hairline p-2"
      >
        <label htmlFor="ai-help-input" className="sr-only">
          Savolingiz
        </label>
        <input
          id="ai-help-input"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Savolingizni yozing..."
          maxLength={500}
          className="h-10 min-w-0 flex-1 rounded-full bg-canvas px-4 text-sm text-ink outline-none placeholder:text-ink-faint"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          aria-label="Yuborish"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-lime text-forest transition-colors hover:bg-lime-dark disabled:opacity-50"
        >
          <Send className="h-4 w-4" aria-hidden="true" />
        </button>
      </form>
    </div>
  );
}
