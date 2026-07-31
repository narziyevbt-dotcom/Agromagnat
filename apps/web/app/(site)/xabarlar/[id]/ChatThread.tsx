'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Send } from 'lucide-react';
import { t } from '@/lib/strings';
import { usePoll } from '@/lib/usePoll';
import type { ChatMessage, MessagePage } from '@/lib/types';
import { sendMessageAction } from '../actions';

/**
 * How often the open thread asks for new messages.
 *
 * Polling, not a socket. The audience is on intermittent mobile data where a
 * dropped connection is the normal case, and a poll that always recovers beats
 * a socket that silently stops delivering. The request is also trimmed to
 * messages newer than the last one seen — see the route handler.
 *
 * Two numbers rather than one: five seconds while messages are arriving, drifting
 * out to thirty when they are not. A fixed six-second interval was 600 requests
 * an hour whether or not anybody was typing, and on a quiet thread every one of
 * them came back empty. See `lib/usePoll.ts`.
 */
const POLL_BASE_MS = 5_000;
const POLL_MAX_MS = 30_000;

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

  const poll = useCallback(async (): Promise<boolean> => {
    const since = sinceRef.current;

    const response = await fetch(
      `/api/chats/${chatId}/messages${since ? `?since=${encodeURIComponent(since)}` : ''}`,
    );
    if (!response.ok) {
      return false;
    }
    const page = (await response.json()) as MessagePage;
    // The API answers newest first; the thread reads oldest to newest.
    merge([...page.items].reverse(), 'end');

    // The return value is what keeps an active conversation feeling instant:
    // every message found resets the delay to the floor.
    return page.items.length > 0;
  }, [chatId, merge]);

  const pollNow = usePoll(poll, { baseMs: POLL_BASE_MS, maxMs: POLL_MAX_MS });

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

    // Sending is the clearest sign a reply is coming, and it is the one signal
    // the poller cannot see for itself — an idle thread that had drifted out to
    // thirty seconds drops back to five the moment somebody types into it.
    pollNow();

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

  // A system line — "savdo yakunlandi", "taklif rad etildi" — belongs to the
  // conversation rather than to either side of it, so it is centred and
  // unattributed instead of sitting in somebody's bubble.
  if (message.type === 'system') {
    return (
      <p className="mx-auto max-w-[85%] rounded-full bg-mint px-3 py-1.5 text-center text-xs font-medium text-harvest">
        {message.body}
      </p>
    );
  }

  // An offer message stores "<offerId>|<preview>" so the panel above can join
  // the card to its row without a request per message. Only the preview is for
  // reading; the id would be noise in the thread.
  const body =
    message.type === 'offer' ? message.body.slice(message.body.indexOf('|') + 1) : message.body;

  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-3 py-2 text-[15px] leading-snug ${
          mine
            ? 'rounded-br-md bg-forest text-white'
            : 'rounded-bl-md bg-surface text-ink ring-1 ring-hairline'
        } ${message.pending ? 'opacity-70' : ''} ${
          message.type === 'offer' ? 'ring-2 ring-harvest/40' : ''
        }`}
      >
        <p className="whitespace-pre-line break-words">{body}</p>

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
