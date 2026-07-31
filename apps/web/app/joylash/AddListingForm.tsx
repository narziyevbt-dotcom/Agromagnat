'use client';

import { useActionState, useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { t } from '@/lib/strings';
import type { Category, District, QuantityUnit, Region } from '@/lib/types';
import { type PublishState, publishListing } from './actions';

const UNITS: Array<{ value: QuantityUnit; label: string }> = [
  { value: 'kg', label: 'kg' },
  { value: 't', label: 'tonna' },
  { value: 'dona', label: 'dona' },
  { value: 'quti', label: 'quti' },
  { value: 'qop', label: 'qop' },
  { value: 'l', label: 'litr' },
  { value: 'ga', label: 'gektar' },
];

const DRAFT_KEY = 'agm:draft:listing';

/**
 * One long form rather than the mobile app's four steps: on a desktop the whole
 * thing fits on screen, and paging through it would only add clicks.
 *
 * The draft is mirrored to localStorage on every change. Connections in the
 * target market drop mid-form regularly, and losing a half-typed listing is the
 * fastest way to lose the seller.
 */
export function AddListingForm({
  categories,
  regions,
}: {
  categories: Category[];
  regions: Region[];
}) {
  const [state, action] = useActionState<PublishState, FormData>(publishListing, {});
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [districts, setDistricts] = useState<District[]>([]);
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(DRAFT_KEY);
      if (stored) {
        setDraft(JSON.parse(stored) as Record<string, string>);
        setRestored(true);
      }
    } catch {
      // A corrupt draft is not worth surfacing; start clean.
    }
  }, []);

  useEffect(() => {
    if (Object.keys(draft).length) {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      } catch {
        // Storage full or blocked — the form still works.
      }
    }
  }, [draft]);

  const regionId = draft.regionId ?? '';

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

  const set = (key: string) => (value: string) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const categoryUnit = categories.find((c) => c.id === draft.categoryId)?.unitDefault;

  return (
    <form
      action={(formData) => {
        localStorage.removeItem(DRAFT_KEY);
        action(formData);
      }}
      className="space-y-5"
    >
      {restored && (
        <p className="rounded-lg bg-turquoise/10 px-3 py-2 text-sm text-turquoise">
          {t.addListing.draftSaved}
        </p>
      )}

      {state.error && (
        <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm font-medium text-danger">
          {state.error}
        </p>
      )}

      <Section title={t.addListing.stepCategory}>
        <Field label={t.addListing.stepCategory} error={state.fieldErrors?.categoryId}>
          <select
            name="categoryId"
            required
            value={draft.categoryId ?? ''}
            onChange={(event) => set('categoryId')(event.target.value)}
            className="tap-target w-full rounded-lg bg-canvas px-3 ring-1 ring-hairline"
          >
            <option value="">— tanlang —</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.nameUz}
              </option>
            ))}
          </select>
        </Field>
      </Section>

      <Section title={t.addListing.stepPhotos}>
        <p className="mb-2 text-sm text-ink-muted">{t.addListing.photosHint}</p>
        <input
          type="file"
          name="photos"
          multiple
          accept="image/jpeg,image/png,image/webp"
          className="tap-target w-full rounded-lg bg-canvas p-2 text-sm ring-1 ring-hairline file:mr-3 file:rounded-md file:border-0 file:bg-cobalt file:px-3 file:py-2 file:text-sm file:text-white"
        />
      </Section>

      <Section title={t.addListing.stepDetails}>
        <Field label={t.addListing.titleLabel} error={state.fieldErrors?.title}>
          <input
            name="title"
            required
            minLength={5}
            maxLength={160}
            value={draft.title ?? ''}
            onChange={(event) => set('title')(event.target.value)}
            placeholder={t.addListing.titlePlaceholder}
            className="tap-target w-full rounded-lg bg-canvas px-3 ring-1 ring-hairline"
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={`${t.addListing.quantityLabel} *`} error={state.fieldErrors?.quantity}>
            <div className="flex gap-2">
              <input
                name="quantity"
                required
                inputMode="decimal"
                value={draft.quantity ?? ''}
                onChange={(event) =>
                  set('quantity')(event.target.value.replace(/[^\d.]/g, ''))
                }
                placeholder="12"
                className="numeric tap-target min-w-0 flex-1 rounded-lg bg-canvas px-3 ring-1 ring-hairline"
              />
              <select
                name="quantityUnit"
                value={draft.quantityUnit ?? categoryUnit ?? 'kg'}
                onChange={(event) => set('quantityUnit')(event.target.value)}
                className="tap-target w-28 rounded-lg bg-canvas px-2 ring-1 ring-hairline"
              >
                {UNITS.map((unit) => (
                  <option key={unit.value} value={unit.value}>
                    {unit.label}
                  </option>
                ))}
              </select>
            </div>
          </Field>

          <Field label={`${t.addListing.priceLabel} *`} error={state.fieldErrors?.price}>
            <div className="flex gap-2">
              <input
                name="price"
                required
                inputMode="numeric"
                value={draft.price ?? ''}
                onChange={(event) => set('price')(event.target.value.replace(/[^\d]/g, ''))}
                placeholder="14000"
                className="numeric tap-target min-w-0 flex-1 rounded-lg bg-canvas px-3 ring-1 ring-hairline"
              />
              <select
                name="priceUnit"
                value={draft.priceUnit ?? categoryUnit ?? 'kg'}
                onChange={(event) => set('priceUnit')(event.target.value)}
                className="tap-target w-28 rounded-lg bg-canvas px-2 ring-1 ring-hairline"
              >
                {UNITS.map((unit) => (
                  <option key={unit.value} value={unit.value}>
                    {unit.label}
                  </option>
                ))}
              </select>
            </div>
          </Field>

          <Field label={`${t.addListing.regionLabel} *`} error={state.fieldErrors?.regionId}>
            <select
              name="regionId"
              required
              value={regionId}
              onChange={(event) => {
                set('regionId')(event.target.value);
                setDraft((prev) => ({ ...prev, districtId: '' }));
              }}
              className="tap-target w-full rounded-lg bg-canvas px-3 ring-1 ring-hairline"
            >
              <option value="">— tanlang —</option>
              {regions.map((region) => (
                <option key={region.id} value={region.id}>
                  {region.nameUz}
                </option>
              ))}
            </select>
          </Field>

          <Field label={`${t.addListing.districtLabel} *`} error={state.fieldErrors?.districtId}>
            <select
              name="districtId"
              required
              value={draft.districtId ?? ''}
              onChange={(event) => set('districtId')(event.target.value)}
              disabled={!regionId}
              className="tap-target w-full rounded-lg bg-canvas px-3 ring-1 ring-hairline disabled:opacity-50"
            >
              <option value="">— tanlang —</option>
              {districts.map((district) => (
                <option key={district.id} value={district.id}>
                  {district.nameUz}
                </option>
              ))}
            </select>
          </Field>

          <Field label={`${t.addListing.minOrderLabel} (${t.addListing.optional})`}>
            <input
              name="minOrder"
              inputMode="decimal"
              value={draft.minOrder ?? ''}
              onChange={(event) => set('minOrder')(event.target.value.replace(/[^\d.]/g, ''))}
              className="numeric tap-target w-full rounded-lg bg-canvas px-3 ring-1 ring-hairline"
            />
          </Field>

          <Field label={`${t.addListing.wholesalePriceLabel} (${t.addListing.optional})`}>
            <input
              name="wholesalePrice"
              inputMode="numeric"
              value={draft.wholesalePrice ?? ''}
              onChange={(event) =>
                set('wholesalePrice')(event.target.value.replace(/[^\d]/g, ''))
              }
              className="numeric tap-target w-full rounded-lg bg-canvas px-3 ring-1 ring-hairline"
            />
          </Field>

          <Field label={`${t.addListing.harvestDateLabel} (${t.addListing.optional})`}>
            <input
              type="date"
              name="harvestDate"
              value={draft.harvestDate ?? ''}
              onChange={(event) => set('harvestDate')(event.target.value)}
              className="numeric tap-target w-full rounded-lg bg-canvas px-3 ring-1 ring-hairline"
            />
          </Field>

          <Field label={t.addListing.deliveryLabel}>
            <select
              name="delivery"
              value={draft.delivery ?? 'none'}
              onChange={(event) => set('delivery')(event.target.value)}
              className="tap-target w-full rounded-lg bg-canvas px-3 ring-1 ring-hairline"
            >
              <option value="none">Kelib olish kerak</option>
              <option value="pickup">Olib ketish</option>
              <option value="delivery">Yetkazib berish</option>
              <option value="both">Ikkalasi ham</option>
            </select>
          </Field>
        </div>

        <Field label={`${t.addListing.descriptionLabel} (${t.addListing.optional})`}>
          <textarea
            name="description"
            rows={4}
            maxLength={4000}
            value={draft.description ?? ''}
            onChange={(event) => set('description')(event.target.value)}
            placeholder={t.addListing.descriptionPlaceholder}
            className="w-full rounded-lg bg-canvas p-3 ring-1 ring-hairline"
          />
        </Field>
      </Section>

      <PublishButton />
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[var(--radius-card)] bg-surface p-4 ring-1 ring-hairline">
      <h2 className="mb-3 text-base font-bold text-ink">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-ink">{label}</span>
      {children}
      {error && <span className="mt-1 block text-xs text-danger">{error}</span>}
    </label>
  );
}

function PublishButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="tap-target w-full rounded-lg bg-saffron px-4 py-3 text-base font-semibold text-white transition-colors hover:bg-saffron-dark disabled:opacity-60"
    >
      {pending ? t.common.loading : t.addListing.publish}
    </button>
  );
}
