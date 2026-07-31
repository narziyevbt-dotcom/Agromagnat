import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { MessageSquare } from 'lucide-react';
import { getChats } from '@/lib/api';
import { formatPrice, formatTimeAgo, initials } from '@/lib/format';
import { getAccessToken } from '@/lib/session';
import { t } from '@/lib/strings';
import type { ChatSummary } from '@/lib/types';

export const metadata: Metadata = {
  title: t.chat.title,
  robots: { index: false, follow: false },
};

/** An inbox is personal and changes on every message — never cache it. */
export const dynamic = 'force-dynamic';

export default async function InboxPage() {
  const token = await getAccessToken();
  if (!token) {
    redirect('/kirish?next=/xabarlar');
  }

  const chats = await getChats(token).catch(() => [] as ChatSummary[]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-5 sm:py-8">
      <h1 className="text-2xl">{t.chat.title}</h1>

      {chats.length === 0 ? (
        <div className="mt-5 rounded-[var(--radius-card)] bg-surface p-10 text-center ring-1 ring-hairline">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-turquoise/10 text-turquoise">
            <MessageSquare className="h-6 w-6" aria-hidden="true" />
          </span>
          <h2 className="mt-4 text-lg">{t.chat.empty}</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-ink-muted">{t.chat.emptyHint}</p>
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-hairline overflow-hidden rounded-[var(--radius-card)] bg-surface ring-1 ring-hairline">
          {chats.map((chat) => (
            <li key={chat.id}>
              <ChatRow chat={chat} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ChatRow({ chat }: { chat: ChatSummary }) {
  const unread = chat.unreadCount > 0;

  return (
    <Link
      href={`/xabarlar/${chat.id}`}
      className="flex items-center gap-3 p-3 transition-colors hover:bg-canvas"
    >
      {chat.listingPhotoUrl ? (
        // The listing photo, not an avatar: a seller recognises the conversation
        // by which of their listings it is about, long before they read the name.
        <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-canvas">
          <Image
            src={chat.listingPhotoUrl}
            alt=""
            fill
            sizes="48px"
            className="object-cover"
          />
        </span>
      ) : (
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-forest text-sm font-semibold text-white">
          {initials(chat.counterpart.name)}
        </span>
      )}

      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span
            className={`truncate text-sm ${unread ? 'font-bold text-ink' : 'font-semibold text-ink'}`}
          >
            {chat.counterpart.name ?? 'Foydalanuvchi'}
          </span>
          {chat.counterpart.isVerified && (
            <span className="shrink-0 text-turquoise" title={t.listing.verified}>
              ✓
            </span>
          )}
          {chat.lastMessageAt && (
            <span className="numeric ml-auto shrink-0 text-[11px] text-ink-faint">
              {formatTimeAgo(chat.lastMessageAt)}
            </span>
          )}
        </span>

        <span className="mt-0.5 block truncate text-xs text-ink-faint">
          {chat.listingTitle}
          {chat.listingPrice && chat.listingPriceUnit && (
            <span className="numeric text-harvest">
              {' · '}
              {formatPrice(chat.listingPrice, chat.listingPriceUnit)}
            </span>
          )}
        </span>

        <span
          className={`mt-0.5 block truncate text-sm ${
            unread ? 'font-medium text-ink' : 'text-ink-muted'
          }`}
        >
          {chat.lastMessageText ?? '—'}
        </span>
      </span>

      {unread && (
        // Turquoise, not saffron: saffron is reserved for CTAs and the TOP
        // badge, and a count of unread messages is neither.
        <span
          className="numeric flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-turquoise px-1.5 text-xs font-bold text-white"
          aria-label={`${chat.unreadCount} ${t.chat.unreadBadge}`}
        >
          {chat.unreadCount}
        </span>
      )}
    </Link>
  );
}
