'use client';

import { useActionState, useEffect, useMemo, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { AiComposer } from '@/components/listing-form/AiComposer';
import { AttributeFields } from '@/components/listing-form/AttributeFields';
import { CategoryPicker } from '@/components/listing-form/CategoryPicker';
import { type PhotoItem, PhotoPanel } from '@/components/listing-form/PhotoPanel';
import { PriceHint } from '@/components/listing-form/PriceHint';
import { t } from '@/lib/strings';
import type {
  Category,
  CategoryFormSpec,
  District,
  ListingDraft,
  Region,
} from '@/lib/types';
import { type PublishState, publishListing } from './actions';

const DRAFT_KEY = 'agm:draft:listing';

const UNIT_LABELS: Record<string, string> = {
  kg: 'kg',
  t: 'tonna',
  dona: 'dona',
  quti: 'quti',
  qop: 'qop',
  l: 'litr',
  ga: 'gektar',
  xizmat: 'xizmat',
};

/**
 * One long form rather than the mobile app's four steps: on a desktop the whole
 * thing fits on screen, and paging through it would only add clicks.
 *
 * What varies is not the layout but the questions. Every field below the
 * category comes from that category's spec, so choosing "Texnika" swaps the
 * volume question for a count, drops the harvest date, and adds a year and a
 * condition — rather than asking a tractor how many kilos it weighs.
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
  const [attrs, setAttrs] = useState<Record<string, string>>({});
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [restored, setRestored] = useState(false);
  const [aiNotes, setAiNotes] = useState<string[]>([]);

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

  const category = categories.find((row) => row.id === draft.categoryId) ?? null;
  const spec: CategoryFormSpec | null = category?.form ?? null;

  /**
   * A unit that was valid for the previous category is often invalid for the
   * new one. Snapping to the first allowed unit is what stops the form from
   * submitting kilos of tractor and being rejected by the server.
   */
  useEffect(() => {
    if (!spec) return;
    setDraft((prev) => {
      const next = { ...prev };
      if (!prev.quantityUnit || !spec.quantity.units.includes(prev.quantityUnit as never)) {
        next.quantityUnit = spec.quantity.units[0];
      }
      if (!prev.priceUnit || !spec.price.units.includes(prev.priceUnit as never)) {
        next.priceUnit = spec.price.units[0];
      }
      if (!spec.optional.harvestDate) delete next.harvestDate;
      if (!spec.optional.minOrder) delete next.minOrder;
      if (!spec.optional.wholesalePrice) delete next.wholesalePrice;
      if (!spec.optional.delivery) delete next.delivery;
      return next;
    });

    // Attributes are per-kind; carrying a tractor's year onto a crate of apples
    // would submit a key the new category's spec does not declare.
    setAttrs((prev) => {
      const allowed = new Set(spec.attributes.map((def) => def.key));
      return Object.fromEntries(Object.entries(prev).filter(([key]) => allowed.has(key)));
    });
  }, [spec]);

  const applyDraft = (generated: ListingDraft) => {
    setDraft((prev) => ({
      ...prev,
      title: generated.title || prev.title || '',
      description: generated.description || prev.description || '',
      ...(generated.categoryId ? { categoryId: generated.categoryId } : {}),
      ...(generated.quantity !== null ? { quantity: String(generated.quantity) } : {}),
      ...(generated.quantityUnit ? { quantityUnit: generated.quantityUnit } : {}),
      ...(generated.price !== null ? { price: String(generated.price) } : {}),
      ...(generated.priceUnit ? { priceUnit: generated.priceUnit } : {}),
      ...(generated.regionId ? { regionId: generated.regionId } : {}),
      ...(generated.districtId ? { districtId: generated.districtId } : {}),
      ...(generated.harvestDate ? { harvestDate: generated.harvestDate } : {}),
    }));
    if (Object.keys(generated.attributes).length) {
      setAttrs((prev) => ({
        ...prev,
        ...Object.fromEntries(
          Object.entries(generated.attributes).map(([key, value]) => [key, String(value)]),
        ),
      }));
    }
    setAiNotes(generated.missingUz);
  };

  const unitOptions = useMemo(
    () =>
      (units: string[]) =>
        units.map((unit) => (
          <option key={unit} value={unit}>
            {UNIT_LABELS[unit] ?? unit}
          </option>
        )),
    [],
  );

  return (
    <div className="space-y-5">
      <AiComposer onDraft={applyDraft} />

      <form
        action={(formData) => {
          localStorage.removeItem(DRAFT_KEY);
          for (const photo of photos) {
            formData.append('photos', photo.file, photo.file.name);
          }
          action(formData);
        }}
        className="space-y-5"
      >
        {restored && (
          <p className="rounded-lg bg-turquoise/10 px-3 py-2 text-sm text-turquoise">
            {t.addListing.draftSaved}
          </p>
        )}

        {aiNotes.length > 0 && (
          <ul className="space-y-1 rounded-lg bg-saffron/10 px-3 py-2 text-sm text-ink">
            <li className="font-semibold">AI to&apos;ldirdi. Quyidagilarni tekshiring:</li>
            {aiNotes.map((note) => (
              <li key={note} className="text-ink-muted">
                • {note}
              </li>
            ))}
          </ul>
        )}

        {state.error && (
          <p
            role="alert"
            className="rounded-lg bg-danger/10 px-3 py-2 text-sm font-medium text-danger"
          >
            {state.error}
          </p>
        )}

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

          <Field label={t.addListing.stepCategory}>
            <CategoryPicker
              categories={categories}
              value={draft.categoryId ?? ''}
              onChange={(id) => set('categoryId')(id)}
              productText={draft.title ?? ''}
              error={state.fieldErrors?.categoryId}
            />
          </Field>
        </Section>

        <Section title={t.addListing.stepPhotos}>
          <PhotoPanel photos={photos} onChange={setPhotos} />
        </Section>

        {spec && (
          <Section title={`${category?.nameUz} — ma'lumotlar`}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label={`${spec.quantity.labelUz} *`}
                hint={spec.quantity.hintUz}
                error={state.fieldErrors?.quantity}
              >
                <div className="flex gap-2">
                  <input
                    name="quantity"
                    required
                    inputMode="decimal"
                    value={draft.quantity ?? ''}
                    onChange={(event) =>
                      set('quantity')(event.target.value.replace(/[^\d.]/g, ''))
                    }
                    placeholder={spec.quantity.placeholder}
                    className="numeric tap-target min-w-0 flex-1 rounded-lg bg-canvas px-3 ring-1 ring-hairline"
                  />
                  <select
                    name="quantityUnit"
                    value={draft.quantityUnit ?? spec.quantity.units[0]}
                    onChange={(event) => set('quantityUnit')(event.target.value)}
                    disabled={spec.quantity.units.length === 1}
                    className="tap-target w-28 rounded-lg bg-canvas px-2 ring-1 ring-hairline disabled:opacity-70"
                  >
                    {unitOptions(spec.quantity.units)}
                  </select>
                </div>
              </Field>

              {/* The price cell is a fragment rather than one Field so the
                  field's own hint stays attached to the input and the market
                  card sits below both, instead of between them. */}
              <div>
              <Field
                label={`${spec.price.labelUz} *`}
                hint={spec.price.hintUz}
                error={state.fieldErrors?.price}
              >
                <div className="flex gap-2">
                  <input
                    name="price"
                    required
                    inputMode="numeric"
                    value={draft.price ?? ''}
                    onChange={(event) =>
                      set('price')(event.target.value.replace(/[^\d]/g, ''))
                    }
                    placeholder={spec.price.placeholder}
                    className="numeric tap-target min-w-0 flex-1 rounded-lg bg-canvas px-3 ring-1 ring-hairline"
                  />
                  <select
                    name="priceUnit"
                    value={draft.priceUnit ?? spec.price.units[0]}
                    onChange={(event) => set('priceUnit')(event.target.value)}
                    disabled={spec.price.units.length === 1}
                    className="tap-target w-28 rounded-lg bg-canvas px-2 ring-1 ring-hairline disabled:opacity-70"
                  >
                    {unitOptions(spec.price.units)}
                  </select>
                </div>

              </Field>

              {/* The market price, right where the number is decided. */}
              {draft.categoryId && (
                <PriceHint
                  categoryId={draft.categoryId}
                  regionId={regionId || undefined}
                  unit={draft.priceUnit ?? spec.price.units[0]}
                  quantity={Number(draft.quantity) || undefined}
                  onApply={set('price')}
                />
              )}
              </div>

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

              <Field
                label={`${t.addListing.districtLabel} *`}
                error={state.fieldErrors?.districtId}
              >
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

              {spec.optional.minOrder && (
                <Field label={`${t.addListing.minOrderLabel} (${t.addListing.optional})`}>
                  <input
                    name="minOrder"
                    inputMode="decimal"
                    value={draft.minOrder ?? ''}
                    onChange={(event) =>
                      set('minOrder')(event.target.value.replace(/[^\d.]/g, ''))
                    }
                    className="numeric tap-target w-full rounded-lg bg-canvas px-3 ring-1 ring-hairline"
                  />
                </Field>
              )}

              {spec.optional.wholesalePrice && (
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
              )}

              {spec.optional.harvestDate && (
                <Field label={`${t.addListing.harvestDateLabel} (${t.addListing.optional})`}>
                  <input
                    type="date"
                    name="harvestDate"
                    value={draft.harvestDate ?? ''}
                    onChange={(event) => set('harvestDate')(event.target.value)}
                    className="numeric tap-target w-full rounded-lg bg-canvas px-3 ring-1 ring-hairline"
                  />
                </Field>
              )}

              {spec.optional.delivery && (
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
              )}
            </div>

            <AttributeFields
              attributes={spec.attributes}
              values={attrs}
              onChange={(key, value) => setAttrs((prev) => ({ ...prev, [key]: value }))}
            />

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
        )}

        {!spec && (
          <p className="rounded-[var(--radius-card)] bg-surface p-4 text-sm text-ink-muted ring-1 ring-hairline">
            Kategoriyani tanlang — qolgan savollar shunga qarab chiqadi.
          </p>
        )}

        <PublishButton disabled={!spec} />
      </form>
    </div>
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
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-ink">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-ink-faint">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-danger">{error}</span>}
    </label>
  );
}

function PublishButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="tap-target w-full rounded-full bg-lime px-4 py-3 text-base font-bold text-forest transition-colors hover:bg-lime-dark disabled:opacity-60"
    >
      {pending ? t.common.loading : t.addListing.publish}
    </button>
  );
}
