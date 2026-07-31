import type { DeliveryOption, PriceUnit, QuantityUnit } from './types';

const UNIT_LABEL: Record<QuantityUnit, string> = {
  kg: 'kg',
  t: 't',
  dona: 'dona',
  quti: 'quti',
  qop: 'qop',
  l: 'l',
  ga: 'ga',
  xizmat: 'xizmat',
};

/**
 * Uzbek convention groups thousands with a space, not a comma: 14 000 so'm.
 * A non-breaking space keeps a price from wrapping mid-number.
 */
export function formatMoney(value: string | number): string {
  const amount = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(amount)) {
    return '—';
  }
  return Math.round(amount).toLocaleString('ru-RU').replace(/ |,/g, ' ');
}

export function formatPrice(price: string | number, unit: PriceUnit): string {
  return `${formatMoney(price)} so'm/${UNIT_LABEL[unit] ?? unit}`;
}

/**
 * Volume, as shown in the green chip on every card.
 * Trailing zeros are dropped — "12 t", never "12.000 t".
 */
export function formatQuantity(value: string | number, unit: QuantityUnit): string {
  const amount = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(amount)) {
    return '—';
  }
  const rounded = Math.round(amount * 1000) / 1000;
  const text = rounded.toLocaleString('ru-RU', { maximumFractionDigits: 3 });
  return `${text.replace(/ /g, ' ')} ${UNIT_LABEL[unit] ?? unit}`;
}

/** Location always reads "Viloyat · Tuman". */
export function formatLocation(region?: { nameUz: string }, district?: { nameUz: string }): string {
  const parts = [region?.nameUz, district?.nameUz].filter(Boolean);
  return parts.join(' · ');
}

const DELIVERY_LABEL: Record<DeliveryOption, string> = {
  none: "Kelib olish kerak",
  pickup: 'Olib ketish',
  delivery: 'Yetkazib berish',
  both: 'Olib ketish yoki yetkazish',
};

export function formatDelivery(option: DeliveryOption): string {
  return DELIVERY_LABEL[option] ?? DELIVERY_LABEL.none;
}

/**
 * Relative time in Uzbek. Anything older than a week gets an absolute date,
 * because "23 kun oldin" is harder to place than "8-iyul".
 */
export function formatTimeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) {
    return '';
  }

  const minutes = Math.floor((Date.now() - then) / 60_000);
  if (minutes < 1) return 'hozirgina';
  if (minutes < 60) return `${minutes} daqiqa oldin`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} soat oldin`;

  const days = Math.floor(hours / 24);
  if (days === 1) return 'kecha';
  if (days < 7) return `${days} kun oldin`;

  return formatDate(iso);
}

const MONTHS_GENITIVE = [
  'yanvar',
  'fevral',
  'mart',
  'aprel',
  'may',
  'iyun',
  'iyul',
  'avgust',
  'sentabr',
  'oktabr',
  'noyabr',
  'dekabr',
];

export function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return `${date.getDate()}-${MONTHS_GENITIVE[date.getMonth()]}`;
}

export const MONTHS_SHORT = [
  'Yan',
  'Fev',
  'Mar',
  'Apr',
  'May',
  'Iyn',
  'Iyl',
  'Avg',
  'Sen',
  'Okt',
  'Noy',
  'Dek',
];

/** "+998 90 123-45-67" from "+998901234567". */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) {
    // An account signed in with Google has no phone until it verifies one.
    return '';
  }
  const match = /^\+998(\d{2})(\d{3})(\d{2})(\d{2})$/.exec(phone);
  return match ? `+998 ${match[1]} ${match[2]}-${match[3]}-${match[4]}` : phone;
}

/** Two-letter monogram for an avatar with no photo. */
export function initials(name: string | null): string {
  if (!name?.trim()) {
    return '?';
  }
  const words = name.trim().split(/\s+/).slice(0, 2);
  return words.map((word) => word[0]?.toUpperCase() ?? '').join('');
}
