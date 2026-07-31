'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, Mic, MicOff, Sparkles, Wand2 } from 'lucide-react';
import type { ListingDraft } from '@/lib/types';

const EXAMPLE =
  "Urgutdan 12 tonna pomidorim bor, birinchi nav, kilosi 14 ming so'mdan, o'zim yetkazib beraman";

/**
 * "Tell me about it and I'll write the listing."
 *
 * This is the primary path on this screen, not a shortcut hidden behind an
 * accordion: the audience is farmers who are quick to describe a harvest out
 * loud and slow to fill in eleven form fields on a phone. The form underneath
 * stays fully editable — the draft is a head start, never a submission.
 *
 * Dictation uses the browser's own speech recognition rather than uploading
 * audio. It costs nothing, works on the Chrome build that ships on the Android
 * phones in this market, and keeps the recording off our servers. Where it is
 * missing the mic simply does not render and typing still works.
 */
export function AiComposer({ onDraft }: { onDraft: (draft: ListingDraft) => void }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [speechAvailable, setSpeechAvailable] = useState(false);
  const recognition = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    const Ctor =
      (window as WindowWithSpeech).SpeechRecognition ??
      (window as WindowWithSpeech).webkitSpeechRecognition;
    if (!Ctor) return;

    const instance = new Ctor();
    instance.lang = 'uz-UZ';
    instance.continuous = true;
    instance.interimResults = false;

    instance.onresult = (event) => {
      let heard = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        heard += event.results[i][0].transcript;
      }
      setText((prev) => (prev ? `${prev} ${heard}`.trim() : heard.trim()));
    };
    instance.onerror = () => {
      setListening(false);
      setError("Ovoz eshitilmadi — matnni yozib ko'ring");
    };
    instance.onend = () => setListening(false);

    recognition.current = instance;
    setSpeechAvailable(true);

    return () => {
      instance.onresult = null;
      instance.onerror = null;
      instance.onend = null;
      try {
        instance.stop();
      } catch {
        // Already stopped.
      }
    };
  }, []);

  const toggleMic = () => {
    const instance = recognition.current;
    if (!instance) return;

    if (listening) {
      instance.stop();
      setListening(false);
      return;
    }
    setError(null);
    try {
      instance.start();
      setListening(true);
    } catch {
      setError('Mikrofonga ruxsat berilmadi');
    }
  };

  const generate = async () => {
    const trimmed = text.trim();
    if (trimmed.length < 10) {
      setError('Mahsulotingiz haqida bir-ikki jumla yozing');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/ai/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: trimmed }),
      });
      const data = (await response.json()) as ListingDraft & { error?: string };

      if (!response.ok) {
        setError(data.error ?? "AI hozir javob bermadi, qo'lda to'ldiring");
        return;
      }
      onDraft(data);
    } catch {
      setError("Internet uzildi — qo'lda to'ldirsangiz ham bo'ladi");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-[var(--radius-card)] bg-forest p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-lime text-forest">
          <Sparkles className="h-4 w-4" aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-sm font-bold text-white">AI e&apos;lonni o&apos;zi yozadi</h2>
          <p className="text-xs text-white/60">
            Mahsulotingizni bir jumlada ayting — qolganini AI to&apos;ldiradi.
          </p>
        </div>
      </div>

      <div className="mt-3 rounded-xl bg-white/95 p-2">
        <label htmlFor="ai-compose" className="sr-only">
          Mahsulot haqida yozing
        </label>
        <textarea
          id="ai-compose"
          rows={3}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={EXAMPLE}
          className="w-full resize-none bg-transparent px-2 py-1 text-sm text-ink outline-none placeholder:text-ink-faint"
        />

        <div className="flex items-center justify-between gap-2 px-1">
          {speechAvailable ? (
            <button
              type="button"
              onClick={toggleMic}
              aria-pressed={listening}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                listening
                  ? 'bg-danger text-white'
                  : 'text-forest ring-1 ring-hairline hover:bg-canvas'
              }`}
            >
              {listening ? (
                <>
                  <MicOff className="h-3.5 w-3.5" aria-hidden="true" />
                  To&apos;xtatish
                </>
              ) : (
                <>
                  <Mic className="h-3.5 w-3.5" aria-hidden="true" />
                  Gapirib ayting
                </>
              )}
            </button>
          ) : (
            <span />
          )}

          <button
            type="button"
            onClick={generate}
            disabled={busy}
            className="tap-target inline-flex items-center gap-2 rounded-full bg-lime px-5 text-sm font-bold text-forest transition-colors hover:bg-lime-dark disabled:opacity-60"
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Yozilmoqda...
              </>
            ) : (
              <>
                <Wand2 className="h-4 w-4" aria-hidden="true" />
                To&apos;ldirib ber
              </>
            )}
          </button>
        </div>
      </div>

      {listening && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-lime">
          <span className="h-2 w-2 animate-pulse rounded-full bg-lime" />
          Eshityapman... gapiring
        </p>
      )}

      {error && (
        <p role="alert" className="mt-2 text-xs font-medium text-white">
          {error}
        </p>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ types */

/**
 * The Web Speech API is not in TypeScript's DOM library and is prefixed on the
 * builds that have it, so the surface this file uses is declared by hand rather
 * than pulled in as a dependency.
 */
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult:
    | ((event: {
        resultIndex: number;
        results: ArrayLike<ArrayLike<{ transcript: string }>>;
      }) => void)
    | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}

interface WindowWithSpeech extends Window {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
}
