'use client';

import { useActionState, useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { formatPhone } from '@/lib/format';
import type { CurrentUser, District, Region } from '@/lib/types';
import { type ProfileState, updateProfileAction } from './actions';

export function SettingsForm({
  user,
  regions,
}: {
  user: CurrentUser;
  regions: Region[];
}) {
  const [state, action] = useActionState<ProfileState, FormData>(updateProfileAction, {});
  const [regionId, setRegionId] = useState(user.region?.id ?? '');
  const [districtId, setDistrictId] = useState(user.district?.id ?? '');
  const [districts, setDistricts] = useState<District[]>([]);

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

  return (
    <form action={action} className="space-y-4">
      {state.error && (
        <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2 text-sm font-medium text-danger">
          {state.error}
        </p>
      )}
      {state.ok && (
        <p className="rounded-xl bg-harvest/10 px-3 py-2 text-sm font-medium text-harvest">
          Saqlandi.
        </p>
      )}

      <Field label="Telefon raqam">
        {/* Identity, not a setting — changing the phone means a new account. */}
        <p className="numeric tap-target flex items-center rounded-xl bg-slate-canvas px-3 text-sm text-ink-muted ring-1 ring-slate-line">
          {formatPhone(user.phone)}
        </p>
      </Field>

      <Field label="Ism">
        <input
          name="name"
          required
          minLength={2}
          maxLength={120}
          defaultValue={user.name ?? ''}
          className="tap-target w-full rounded-xl border border-slate-line bg-white px-3 text-sm"
        />
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Viloyat">
          <select
            name="regionId"
            value={regionId}
            onChange={(event) => {
              setRegionId(event.target.value);
              setDistrictId('');
            }}
            className="tap-target w-full rounded-xl border border-slate-line bg-white px-3 text-sm"
          >
            <option value="">— tanlanmagan —</option>
            {regions.map((region) => (
              <option key={region.id} value={region.id}>
                {region.nameUz}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Tuman">
          <select
            name="districtId"
            value={districtId}
            onChange={(event) => setDistrictId(event.target.value)}
            disabled={!regionId}
            className="tap-target w-full rounded-xl border border-slate-line bg-white px-3 text-sm disabled:opacity-50"
          >
            <option value="">— tanlanmagan —</option>
            {districts.map((district) => (
              <option key={district.id} value={district.id}>
                {district.nameUz}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <SaveButton />
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-ink">{label}</span>
      {children}
    </label>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="tap-target rounded-xl bg-lime px-6 text-sm font-semibold text-cobalt hover:bg-lime-dark disabled:opacity-60"
    >
      {pending ? 'Saqlanmoqda...' : 'Saqlash'}
    </button>
  );
}
