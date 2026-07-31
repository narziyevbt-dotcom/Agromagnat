'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { t } from '@/lib/strings';
import type { Category, District, Region } from '@/lib/types';

/**
 * Filter chips plus a collapsible panel.
 *
 * Every filter lives in the URL rather than in component state. That is what
 * makes a filtered search shareable, linkable from Telegram, and indexable —
 * and it survives the back button for free.
 */
export function SearchFilters({
  categories,
  regions,
}: {
  categories: Category[];
  regions: Region[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [open, setOpen] = useState(false);
  const [districts, setDistricts] = useState<District[]>([]);

  const regionId = params.get('regionId') ?? '';

  const update = useCallback(
    (changes: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(changes)) {
        if (value === null || value === '') {
          next.delete(key);
        } else {
          next.set(key, value);
        }
      }
      // Any filter change invalidates the cursor — page 2 of the old query is
      // meaningless against the new one.
      next.delete('cursor');
      router.push(`/qidiruv?${next.toString()}`);
    },
    [params, router],
  );

  // Districts depend on the chosen region, so they load after it is picked.
  useEffect(() => {
    if (!regionId) {
      setDistricts([]);
      return;
    }
    let cancelled = false;
    fetch(`/api/districts?regionId=${regionId}`)
      .then((response) => (response.ok ? response.json() : []))
      .then((rows: District[]) => {
        if (!cancelled) setDistricts(rows);
      })
      .catch(() => setDistricts([]));
    return () => {
      cancelled = true;
    };
  }, [regionId]);

  const toggle = (key: string, value: string) => {
    update({ [key]: params.get(key) === value ? null : value });
  };

  const activeCount = [
    'categoryId',
    'regionId',
    'districtId',
    'priceMin',
    'priceMax',
    'quantityMin',
    'verifiedOnly',
    'withDelivery',
  ].filter((key) => params.get(key)).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Chip
          active={open}
          onClick={() => setOpen((value) => !value)}
          label={`${t.search.filters}${activeCount ? ` (${activeCount})` : ''}`}
        />
        <Chip
          active={params.get('quantityMin') === '1'}
          onClick={() => toggle('quantityMin', '1')}
          label={t.search.wholesale}
        />
        <Chip
          active={params.get('verifiedOnly') === 'true'}
          onClick={() => toggle('verifiedOnly', 'true')}
          label={t.search.verified}
        />
        <Chip
          active={params.get('withDelivery') === 'true'}
          onClick={() => toggle('withDelivery', 'true')}
          label={t.search.withDelivery}
        />

        <select
          value={params.get('sort') ?? 'newest'}
          onChange={(event) => update({ sort: event.target.value })}
          aria-label={t.search.sort}
          className="tap-target ml-auto rounded-full bg-surface px-3 text-sm text-ink ring-1 ring-hairline"
        >
          <option value="newest">{t.search.sortNewest}</option>
          <option value="cheapest">{t.search.sortCheapest}</option>
          <option value="expensive">{t.search.sortExpensive}</option>
        </select>
      </div>

      {open && (
        <div className="grid gap-3 rounded-[var(--radius-card)] bg-surface p-4 ring-1 ring-hairline sm:grid-cols-2 lg:grid-cols-3">
          <Field label={t.search.allCategories}>
            <select
              value={params.get('categoryId') ?? ''}
              onChange={(event) => update({ categoryId: event.target.value })}
              className="tap-target w-full rounded-lg bg-canvas px-3 text-sm ring-1 ring-hairline"
            >
              <option value="">{t.search.allCategories}</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.nameUz}
                </option>
              ))}
            </select>
          </Field>

          <Field label={t.search.allRegions}>
            <select
              value={regionId}
              onChange={(event) =>
                update({ regionId: event.target.value, districtId: null })
              }
              className="tap-target w-full rounded-lg bg-canvas px-3 text-sm ring-1 ring-hairline"
            >
              <option value="">{t.search.allRegions}</option>
              {regions.map((region) => (
                <option key={region.id} value={region.id}>
                  {region.nameUz}
                </option>
              ))}
            </select>
          </Field>

          <Field label={t.search.allDistricts}>
            <select
              value={params.get('districtId') ?? ''}
              onChange={(event) => update({ districtId: event.target.value })}
              disabled={!regionId || districts.length === 0}
              className="tap-target w-full rounded-lg bg-canvas px-3 text-sm ring-1 ring-hairline disabled:opacity-50"
            >
              <option value="">{t.search.allDistricts}</option>
              {districts.map((district) => (
                <option key={district.id} value={district.id}>
                  {district.nameUz}
                </option>
              ))}
            </select>
          </Field>

          <Field label={t.search.priceFrom}>
            <NumberInput
              value={params.get('priceMin') ?? ''}
              onCommit={(value) => update({ priceMin: value })}
              placeholder="0"
            />
          </Field>

          <Field label={t.search.priceTo}>
            <NumberInput
              value={params.get('priceMax') ?? ''}
              onCommit={(value) => update({ priceMax: value })}
              placeholder="100 000"
            />
          </Field>

          <div className="flex items-end">
            <button
              type="button"
              onClick={() => router.push('/qidiruv')}
              className="tap-target w-full rounded-lg px-3 text-sm font-medium text-ink-muted ring-1 ring-hairline hover:text-forest"
            >
              {t.search.reset}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Chip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`tap-target rounded-full px-3.5 text-sm font-medium transition-colors ${
        active
          ? 'bg-forest text-white'
          : 'bg-surface text-ink ring-1 ring-hairline hover:ring-turquoise'
      }`}
    >
      {label}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-ink-muted">{label}</span>
      {children}
    </label>
  );
}

/** Commits on blur or Enter, so typing a price does not fire a request per keystroke. */
function NumberInput({
  value,
  onCommit,
  placeholder,
}: {
  value: string;
  onCommit: (value: string) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  return (
    <input
      type="text"
      inputMode="numeric"
      value={draft}
      placeholder={placeholder}
      onChange={(event) => setDraft(event.target.value.replace(/\D/g, ''))}
      onBlur={() => draft !== value && onCommit(draft)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          onCommit(draft);
        }
      }}
      className="numeric tap-target w-full rounded-lg bg-canvas px-3 text-sm ring-1 ring-hairline"
    />
  );
}
