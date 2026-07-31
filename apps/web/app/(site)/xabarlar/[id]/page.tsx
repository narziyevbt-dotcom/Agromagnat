import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, Phone } from 'lucide-react';
import { ApiError, getChat, getMessages, getMe, markChatRead } from '@/lib/api';
import { formatPhone, formatPrice, initials } from '@/lib/format';
import { getAccessToken } from '@/lib/session';
import { t } from '@/lib/strings';
import { ChatThread } from './ChatThread';

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = {
  title: t.chat.title,
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function ChatPage({ params }: Props) {
  const { id } = await params;
  const token = await getAccessToken();
  if (!token) {
    redirect(`/kirish?next=/xabarlar/${id}`);
  }

  const chat = await getChat(id, token).catch((error) => {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  });

  if (!chat) {
    notFound();
  }

  const [page, me] = await Promise.all([
    getMessages(id, token, { limit: 30 }),
    getMe(token),
  ]);

  // Opening the thread is what "read" means. Fired here rather than from the
  // client so the badge is already clear when the screen paints.
  await markChatRead(id, token).catch(() => null);

  // The API returns newest first; a conversation reads oldest to newest.
  const messages = [...page.items].reverse();

  return (
    <div className="mx-auto flex max-w-3xl flex-col px-4 py-4 sm:py-6">
      <header className="rounded-t-[var(--radius-card)] bg-surface p-3 ring-1 ring-hairline">
        <div className="flex items-center gap-3">
          <Link
            href="/xabarlar"
            aria-label={t.chat.backToInbox}
            className="tap-target -ml-1 flex items-center justify-center rounded-xl text-ink-muted hover:text-forest"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          </Link>

          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-forest text-sm font-semibold text-white">
            {initials(chat.counterpart.name)}
          </span>

          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 truncate font-semibold text-ink">
              {chat.counterpart.name ?? 'Foydalanuvchi'}
              {chat.counterpart.isVerified && (
                <span className="text-turquoise" title={t.listing.verified}>
                  ✓
                </span>
              )}
            </p>
            <p className="text-xs text-ink-faint">
              {chat.role === 'buyer' ? t.chat.youAreBuyer : t.chat.youAreSeller}
            </p>
          </div>

          {/* The phone stays one tap away — chat supplements the call, it does
              not replace it, and a farmer mid-negotiation will reach for it. */}
          <a
            href={`tel:${chat.counterpart.phone}`}
            aria-label={`${t.listing.call} ${formatPhone(chat.counterpart.phone)}`}
            className="tap-target flex items-center justify-center rounded-xl bg-harvest/10 px-3 text-harvest hover:bg-harvest/15"
          >
            <Phone className="h-5 w-5" aria-hidden="true" />
          </a>
        </div>

        <Link
          href={`/e/${chat.listingId}`}
          className="mt-2 flex items-center gap-2 rounded-xl bg-canvas px-3 py-2 text-xs transition-colors hover:bg-hairline/60"
        >
          <span className="truncate text-ink-muted">
            {t.chat.aboutListing}: <span className="text-ink">{chat.listingTitle}</span>
          </span>
          {chat.listingPrice && chat.listingPriceUnit && (
            <span className="numeric ml-auto shrink-0 font-semibold text-harvest">
              {formatPrice(chat.listingPrice, chat.listingPriceUnit)}
            </span>
          )}
        </Link>
      </header>

      <ChatThread
        chatId={chat.id}
        viewerId={me.id}
        initialMessages={messages}
        initialCursor={page.nextCursor}
        initialHasMore={page.hasMore}
      />
    </div>
  );
}
