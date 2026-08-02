'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ImagePlus, Send } from 'lucide-react';
import { t } from '@/lib/strings';
import type { ChatMessage, MessagePage } from '@/lib/types';
import { sendChatPhotoAction, sendMessageAction } from '../actions';

/**
 * How often the open thread asks for new messages.
 *
 * Polling, not a socket. The audience is on intermittent mobile data where a
 * dropped connection is the normal case, and a six-second poll that always
 * recovers beats a socket that silently stops delivering. The request is also
 * trimmed to messages newer than the last one seen — see the route handler.
 */
const POLL_INTERVAL_MS = 6_000;

interface Props {
  chatId: string;
  viewerId: string;
  initialMessages: ChatMessage[];
  initialCursor: string | null;
  initialHasMore: boolean;
}

type Outgoing = ChatMessage & { failed?: boolean };

export function ChatThread({
  chatId,
  viewerId,
  initialMessages,
  initialCursor,
  initialHasMore,
}: Props) {
  const [messages, setMessages] = useState<Outgoing[]>(initialMessages);
  const [cursor, setCursor] = useState(initialCursor);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  /// A photo carries no clientId, so a failed upload has no pending bubble to
  /// mark — it gets a line above the composer instead.
  const [error, setError] = useState<string | null>(null);
  const [loadingEarlier, setLoadingEarlier] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  /** Merges by id, so a polled message that is already on screen is not doubled. */
  const merge = useCallback((incoming: ChatMessage[], position: 'start' | 'end') => {
    if (!incoming.length) {
      return;
    }
    setMessages((current) => {
      const seen = new Set(current.map((message) => message.id));
      const fresh = incoming.filter((message) => !seen.has(message.id));
      if (!fresh.length) {
        return current;
      }
      return position === 'start' ? [...fresh, ...current] : [...current, ...fresh];
    });
  }, []);

  // The watermark the poll asks from, kept in a ref rather than read off state:
  // as a dependency it would tear down and rebuild the interval on every
  // message, and a thread busy enough to reset a six-second timer would never
  // get to poll at all.
  const sinceRef = useRef<string | undefined>(
    initialMessages[initialMessages.length - 1]?.createdAt,
  );

  useEffect(() => {
    const last = messages[messages.length - 1];
    if (last && !last.pending) {
      sinceRef.current = last.createdAt;
    }
  }, [messages]);

  // Poll while the tab is in front. A backgrounded thread is not being read, and
  // waking a phone radio every six seconds for nothing is how an app earns a
  // reputation for eating data.
  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      if (document.hidden) {
        return;
      }
      const since = sinceRef.current;

      try {
        const response = await fetch(
          `/api/chats/${chatId}/messages${since ? `?since=${encodeURIComponent(since)}` : ''}`,
        );
        if (!response.ok || cancelled) {
          return;
        }
        const page = (await response.json()) as MessagePage;
        // The API answers newest first; the thread reads oldest to newest.
        merge([...page.items].reverse(), 'end');
      } catch {
        // A failed poll is not worth surfacing — the next one is six seconds away.
      }
    };

    const timer = setInterval(poll, POLL_INTERVAL_MS);
    document.addEventListener('visibilitychange', poll);

    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', poll);
    };
  }, [chatId, merge]);

  // Follow the conversation down as it grows.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  const loadEarlier = async () => {
    if (!cursor || loadingEarlier) {
      return;
    }
    setLoadingEarlier(true);
    try {
      const response = await fetch(
        `/api/chats/${chatId}/messages?cursor=${encodeURIComponent(cursor)}`,
      );
      if (response.ok) {
        const page = (await response.json()) as MessagePage;
        merge([...page.items].reverse(), 'start');
        setCursor(page.nextCursor);
        setHasMore(page.hasMore);
      }
    } finally {
      setLoadingEarlier(false);
    }
  };

  const send = async (text: string, clientId: string) => {
    setSending(true);
    const result = await sendMessageAction(chatId, text, clientId);
    setSending(false);

    setMessages((current) =>
      current.map((message) =>
        message.clientId !== clientId
          ? message
          : result.message
            ? { ...result.message, pending: false }
            : { ...message, pending: false, failed: true },
      ),
    );
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || sending) {
      return;
    }

    // The clientId is generated here and reused on every retry, so a message the
    // server stored but never acknowledged cannot be posted a second time.
    const clientId = crypto.randomUUID();
    setDraft('');
    setMessages((current) => [
      ...current,
      {
        id: `pending-${clientId}`,
        chatId,
        senderId: viewerId,
        type: 'text',
        body: text,
        clientId,
        readAt: null,
        createdAt: new Date().toISOString(),
        pending: true,
      },
    ]);

    await send(text, clientId);
  };

  const sendPhoto = async (file: File) => {
    setSending(true);
    setError(null);
    const form = new FormData();
    form.append('file', file);

    const result = await sendChatPhotoAction(chatId, form);
    setSending(false);

    if (result.message) {
      setMessages((current) => [...current, result.message!]);
      return;
    }
    setError(result.error ?? null);
  };

  const retry = async (message: Outgoing) => {
    if (!message.clientId) {
      return;
    }
    setMessages((current) =>
      current.map((item) =>
        item.clientId === message.clientId
          ? { ...item, failed: false, pending: true }
          : item,
      ),
    );
    await send(message.body, message.clientId);
  };

  return (
    <>
      <div
        ref={listRef}
        className="flex max-h-[60vh] min-h-[40vh] flex-col gap-2 overflow-y-auto border-x border-hairline bg-canvas p-3"
      >
        {hasMore && (
          <button
            type="button"
            onClick={loadEarlier}
            disabled={loadingEarlier}
            className="tap-target mx-auto rounded-full bg-surface px-4 text-xs text-ink-muted ring-1 ring-hairline disabled:opacity-60"
          >
            {loadingEarlier ? t.common.loading : t.chat.loadEarlier}
          </button>
        )}

        {messages.map((message) => (
          <Bubble
            key={message.id}
            message={message}
            mine={message.senderId === viewerId}
            onRetry={retry}
          />
        ))}

        <div ref={bottomRef} />
      </div>

      {error && (
        <p className="bg-surface px-3 pt-2 text-xs text-danger">{error}</p>
      )}

      <form
        onSubmit={submit}
        className="flex items-end gap-2 rounded-b-[var(--radius-card)] bg-surface p-3 ring-1 ring-hairline"
      >
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            // Enter sends, Shift+Enter breaks the line — the convention every
            // messaging app on the user's phone already follows.
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              void submit(event);
            }
          }}
          rows={1}
          maxLength={2000}
          placeholder={t.chat.placeholder}
          aria-label={t.chat.placeholder}
          className="max-h-32 min-h-11 flex-1 resize-y rounded-xl bg-canvas px-3 py-2.5 text-[15px] text-ink outline-none ring-1 ring-hairline focus:ring-turquoise"
        />
        <label
          className="tap-target flex w-12 cursor-pointer items-center justify-center rounded-xl text-ink-muted ring-1 ring-hairline hover:text-forest"
          aria-label={t.chat.attachPhoto}
        >
          <ImagePlus className="h-5 w-5" aria-hidden="true" />
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={sending}
            onChange={(event) => {
              const file = event.target.files?.[0];
              // Cleared straight away so picking the same file twice fires
              // change again — otherwise the second attempt does nothing.
              event.target.value = '';
              if (file) {
                void sendPhoto(file);
              }
            }}
          />
        </label>
        <button
          type="submit"
          disabled={sending || !draft.trim()}
          aria-label={t.chat.send}
          className="tap-target flex w-12 items-center justify-center rounded-xl bg-saffron text-white transition-colors hover:bg-saffron-dark disabled:opacity-50"
        >
          <Send className="h-5 w-5" aria-hidden="true" />
        </button>
      </form>
    </>
  );
}

function Bubble({
  message,
  mine,
  onRetry,
}: {
  message: Outgoing;
  mine: boolean;
  onRetry: (message: Outgoing) => void;
}) {
  const time = new Date(message.createdAt).toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-3 py-2 text-[15px] leading-snug ${
          mine
            ? 'rounded-br-md bg-forest text-white'
            : 'rounded-bl-md bg-surface text-ink ring-1 ring-hairline'
        } ${message.pending ? 'opacity-70' : ''}`}
      >
        {message.type === 'image' ? (
          // eslint-disable-next-line @next/next/no-img-element -- the URL is
          // an arbitrary bucket host, and next/image would need every one of
          // them whitelisted in the config.
          <img
            src={message.body}
            alt=""
            className="max-h-64 rounded-lg object-cover"
          />
        ) : (
          <p className="whitespace-pre-line break-words">{message.body}</p>
        )}

        <p
          className={`numeric mt-0.5 flex items-center justify-end gap-1 text-[10px] ${
            mine ? 'text-white/60' : 'text-ink-faint'
          }`}
        >
          {message.failed ? (
            <button
              type="button"
              onClick={() => onRetry(message)}
              className="font-sans text-[11px] font-medium text-danger underline underline-offset-2"
            >
              {t.chat.notDelivered} · {t.chat.retry}
            </button>
          ) : (
            <>
              {time}
              {mine && !message.pending && <span>{message.readAt ? '✓✓' : '✓'}</span>}
            </>
          )}
        </p>
      </div>
    </div>
  );
}
