'use client';

import type { AttributeDef } from '@/lib/types';

/**
 * The category-specific questions, rendered from the spec the API returned.
 *
 * Nothing here knows what a tractor is. The backend decides that machinery is
 * asked for a year and a condition and produce is asked for a grade; this file
 * only knows how to draw a select, a number and a text box. That is what keeps
 * a new field a backend change rather than a release on three clients.
 *
 * Values are submitted as `attr.<key>` and reassembled by the server action, so
 * the whole bag rides along in the same FormData as the rest of the form.
 */
export function AttributeFields({
  attributes,
  values,
  onChange,
}: {
  attributes: AttributeDef[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
}) {
  if (!attributes.length) return null;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {attributes.map((def) => (
        <label key={def.key} className="block">
          <span className="mb-1 block text-sm font-medium text-ink">
            {def.labelUz}
            {def.required ? ' *' : ''}
          </span>

          {def.type === 'select' ? (
            <select
              name={`attr.${def.key}`}
              required={def.required}
              value={values[def.key] ?? ''}
              onChange={(event) => onChange(def.key, event.target.value)}
              className="tap-target w-full rounded-lg bg-canvas px-3 ring-1 ring-hairline"
            >
              <option value="">— tanlang —</option>
              {def.options?.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.labelUz}
                </option>
              ))}
            </select>
          ) : def.type === 'number' ? (
            <div className="relative">
              <input
                name={`attr.${def.key}`}
                required={def.required}
                inputMode="numeric"
                min={def.min}
                max={def.max}
                value={values[def.key] ?? ''}
                onChange={(event) =>
                  onChange(def.key, event.target.value.replace(/[^\d]/g, ''))
                }
                placeholder={def.placeholderUz}
                className="numeric tap-target w-full rounded-lg bg-canvas px-3 ring-1 ring-hairline"
              />
              {def.suffixUz && (
                <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-ink-faint">
                  {def.suffixUz}
                </span>
              )}
            </div>
          ) : (
            <input
              name={`attr.${def.key}`}
              required={def.required}
              maxLength={def.maxLength}
              value={values[def.key] ?? ''}
              onChange={(event) => onChange(def.key, event.target.value)}
              placeholder={def.placeholderUz}
              className="tap-target w-full rounded-lg bg-canvas px-3 ring-1 ring-hairline"
            />
          )}
        </label>
      ))}
    </div>
  );
}
