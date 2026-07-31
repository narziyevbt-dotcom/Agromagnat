import { MONTHS_SHORT } from '@/lib/format';
import { t } from '@/lib/strings';

/**
 * The 12-month harvest strip — the signature element of the listing page.
 *
 * Active months are harvest green, the current month is saffron. A buyer
 * planning a season needs to know when this product is available at a glance,
 * which no amount of description text conveys as fast.
 */
export function SeasonStrip({ months }: { months: number[] }) {
  if (!months?.length) {
    return null;
  }

  const active = new Set(months);
  const current = new Date().getMonth() + 1;

  return (
    <section aria-labelledby="season-heading">
      <h2 id="season-heading" className="mb-2 text-sm font-semibold text-ink-muted">
        {t.listing.season}
      </h2>
      <ol className="flex gap-1" role="list">
        {MONTHS_SHORT.map((label, index) => {
          const month = index + 1;
          const isActive = active.has(month);
          const isCurrent = month === current;

          return (
            <li key={label} className="flex-1">
              <div
                className={`h-1.5 rounded-full ${
                  isCurrent && isActive
                    ? 'bg-saffron'
                    : isActive
                      ? 'bg-harvest'
                      : 'bg-hairline'
                }`}
                aria-hidden="true"
              />
              <span
                className={`mt-1 block text-center text-[10px] ${
                  isCurrent
                    ? 'font-bold text-saffron'
                    : isActive
                      ? 'font-medium text-harvest'
                      : 'text-ink-faint'
                }`}
              >
                {label}
              </span>
              <span className="sr-only">
                {isActive ? 'mavsumda' : 'mavsumdan tashqari'}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
