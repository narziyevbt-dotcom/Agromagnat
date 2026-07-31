'use client';

import { useState, useTransition } from 'react';
import { Check, Handshake, Loader2, X } from 'lucide-react';
import {
  createOfferAction,
  loadOffersAction,
  respondToOfferAction,
} from '@/app/(site)/xabarlar/offer-actions';
import type { Offer } from '@/lib/types';
import { usePoll } from '@/lib/usePoll';

/**
 * Price negotiation, above the message thread.
 *
 * Negotiation on a classifieds board normally happens on the phone, which
 * means nothing is written down: the two sides disagree later about what was
 * said, and the platform learns neither the agreed price nor whether a sale
 * happened. Here the offer is a record both sides can see, and accepting it
 * closes the sale — which is also what finally makes reviews reachable without
 * asking a seller to delist their own advert by hand.
 *
 * The panel only appears when there is something to act on or to remember, so
 * an ordinary conversation is not cluttered by a form nobody is using.
 */
export function OfferPanel({
  chatId,
  askingPrice,
  priceUnit,
  initialOffers,
}: {
  chatId: string;
  askingPrice: string | null;
  priceUnit: string | null;
  initialOffers: Offer[];
}) {
  const [offers, setOffers] = useState<Offer[]>(initialOffers);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const live = offers.find((offer) => offer.status === 'pending') ?? null;
  const accepted = offers.find((offer) => offer.status === 'accepted') ?? null;
  const mineIsLive = live?.isMine ?? false;

  // A deal made on the other device, or by the counterpart while this tab sat
  // open, has to appear here — the thread polls, so this does too, but far less
  // often because an offer is a rare event next to a message.
  //
  // Backed off like the thread, and starting slower: a fixed twenty seconds was
  // 180 requests an hour for something that happens a handful of times in the
  // life of a conversation. On a quiet chat this settles at two a minute.
  usePoll(
    async () => {
      const state = await loadOffersAction(chatId);
      if (!state.offers) return false;
      setOffers(state.offers);
      // "Something happened" here means a *pending* offer — a settled list is
      // the steady state, and treating it as news would pin the delay at the
      // floor for the rest of the conversation.
      return state.offers.some((offer) => offer.status === 'pending');
    },
    { baseMs: 20_000, maxMs: 60_000 },
  );

  const run = (action: () => Promise<{ offers?: Offer[]; error?: string }>) => {
    setError(null);
    startTransition(async () => {
      const state = await action();
      if (state.error) setError(state.error);
      if (state.offers) setOffers(state.offers);
    });
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const value = Number(amount.replace(/\s/g, ''));
    if (!value) {
      setError('Narxni kiriting');
      return;
    }
    run(async () => {
      const state = await createOfferAction(chatId, value, note.trim() || undefined);
      if (!state.error) {
        setAmount('');
        setNote('');
        setOpen(false);
      }
      return state;
    });
  };

  if (accepted) {
    return (
      <div className="flex items-center gap-3 rounded-t-[var(--radius-card)] bg-harvest px-4 py-3 text-white">
        <Handshake className="h-5 w-5 shrink-0" aria-hidden="true" />
        <div>
          <p className="text-sm font-bold">Savdo yakunlandi</p>
          <p className="numeric text-xs text-white/85">
            {money(accepted.amount)} so&apos;m/{accepted.priceUnit}
            {accepted.quantity ? ` · ${money(accepted.quantity)} ${accepted.quantityUnit}` : ''}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-t-[var(--radius-card)] bg-surface px-4 py-3 ring-1 ring-hairline">
      {live ? (
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-ink-muted">
              {mineIsLive ? 'Sizning taklifingiz' : 'Sizga taklif'}
            </p>
            <p className="numeric text-lg font-bold text-forest">
              {money(live.amount)} so&apos;m/{live.priceUnit}
            </p>
            {live.note && <p className="text-xs text-ink-muted">{live.note}</p>}
          </div>

          {live.canRespond ? (
            <div className="flex gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => respondToOfferAction(chatId, live.id, 'accept'))}
                className="tap-target inline-flex items-center gap-1.5 rounded-full bg-harvest px-4 text-sm font-bold text-white transition-colors hover:bg-harvest/90 disabled:opacity-60"
              >
                {pending ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Check className="h-4 w-4" aria-hidden="true" />
                )}
                Roziman
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => respondToOfferAction(chatId, live.id, 'decline'))}
                className="tap-target inline-flex items-center gap-1.5 rounded-full px-4 text-sm font-semibold text-ink-muted ring-1 ring-hairline transition-colors hover:text-danger disabled:opacity-60"
              >
                <X className="h-4 w-4" aria-hidden="true" />
                Rad etish
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => respondToOfferAction(chatId, live.id, 'withdraw'))}
              className="rounded-full px-3 py-1.5 text-xs font-semibold text-ink-muted ring-1 ring-hairline transition-colors hover:text-danger disabled:opacity-60"
            >
              Bekor qilish
            </button>
          )}
        </div>
      ) : open ? (
        <form onSubmit={submit} className="space-y-2">
          <div className="flex items-center gap-2">
            <input
              inputMode="numeric"
              value={amount}
              onChange={(event) => setAmount(event.target.value.replace(/[^\d]/g, ''))}
              placeholder={askingPrice ? String(Math.round(Number(askingPrice))) : '12000'}
              aria-label="Taklif narxi"
              className="numeric tap-target min-w-0 flex-1 rounded-lg bg-canvas px-3 ring-1 ring-hairline"
            />
            <span className="shrink-0 text-sm text-ink-muted">so&apos;m/{priceUnit ?? 'kg'}</span>
            <button
              type="submit"
              disabled={pending}
              className="tap-target shrink-0 rounded-full bg-lime px-4 text-sm font-bold text-forest transition-colors hover:bg-lime-dark disabled:opacity-60"
            >
              Yuborish
            </button>
          </div>
          <input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={300}
            placeholder="Izoh (ixtiyoriy) — masalan: o'zim olib ketaman"
            aria-label="Izoh"
            className="w-full rounded-lg bg-canvas px-3 py-2 text-sm ring-1 ring-hairline"
          />
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="tap-target inline-flex items-center gap-2 rounded-full bg-mint px-4 text-sm font-bold text-harvest ring-1 ring-harvest/20 transition-colors hover:bg-mint/70"
        >
          <Handshake className="h-4 w-4" aria-hidden="true" />
          Narx taklif qilish
        </button>
      )}

      {error && (
        <p role="alert" className="mt-2 text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

/** Thousands separated the way the audience reads them. */
function money(value: string): string {
  return String(Math.round(Number(value))).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}
