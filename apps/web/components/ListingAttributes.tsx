import { getCategoryForm } from '@/lib/api';
import type { Listing } from '@/lib/types';

/**
 * The category-specific answers on a listing detail page — a tractor's year and
 * condition, a plot's tenure, a crop's grade.
 *
 * Labels come from the same spec the posting form was rendered from, so a buyer
 * reads back exactly what the seller was asked. Rendering raw keys would show
 * "condition: used" to somebody who does not read English.
 *
 * The spec fetch is its own request rather than being carried on the listing:
 * it is shared by every listing in the category and cached for an hour, so it
 * costs one round trip per category per hour instead of bytes on every listing.
 */
export async function ListingAttributes({ listing }: { listing: Listing }) {
  const entries = Object.entries(listing.attributes ?? {});
  if (!entries.length) return null;

  const spec = await getCategoryForm(listing.categoryId).catch(() => null);
  if (!spec) return null;

  const rows = spec.attributes
    .map((def) => {
      const raw = listing.attributes[def.key];
      if (raw === undefined || raw === null || raw === '') return null;

      const label =
        def.type === 'select'
          ? (def.options?.find((option) => option.value === String(raw))?.labelUz ??
            String(raw))
          : `${raw}${def.suffixUz ? ` ${def.suffixUz}` : ''}`;

      return { key: def.key, name: def.labelUz, value: label, numeric: def.type === 'number' };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  if (!rows.length) return null;

  return (
    <dl className="grid grid-cols-2 gap-3">
      {rows.map((row) => (
        <div key={row.key} className="rounded-xl bg-surface p-3 ring-1 ring-hairline">
          <dt className="text-xs text-ink-muted">{row.name}</dt>
          <dd className={`mt-0.5 text-sm font-semibold text-ink ${row.numeric ? 'numeric' : ''}`}>
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
