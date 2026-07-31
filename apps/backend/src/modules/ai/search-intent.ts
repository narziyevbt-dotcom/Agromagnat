import { SearchIntent } from './ai.types';

/**
 * The Uzbek line that tells a searcher what the system understood.
 *
 * Written from the filters rather than by either provider, for the same reason
 * the price explanation is: the sentence must be identical for identical
 * filters whichever pass produced them, and it must never be able to disagree
 * with the chips rendered beside it.
 *
 * It exists because natural-language search fails silently otherwise. A query
 * that was misread returns the wrong listings and looks like an empty market;
 * showing the interpretation turns that into something the buyer can correct.
 */
export function describeIntent(intent: SearchIntent): string {
  const parts: string[] = [];

  if (intent.regionName) parts.push(intent.regionName);
  if (intent.leftoverQ) parts.push(`«${intent.leftoverQ}»`);

  if (intent.quantityMin) {
    parts.push(`${formatNumber(intent.quantityMin)} tonnadan ko'p`);
  }

  if (intent.priceMin && intent.priceMax) {
    parts.push(`${formatNumber(intent.priceMin)}–${formatNumber(intent.priceMax)} so'm`);
  } else if (intent.priceMax) {
    parts.push(`${formatNumber(intent.priceMax)} so'mgacha`);
  } else if (intent.priceMin) {
    parts.push(`${formatNumber(intent.priceMin)} so'mdan yuqori`);
  }

  if (intent.withDelivery) parts.push('yetkazib berish bilan');
  if (intent.verifiedOnly) parts.push('tasdiqlangan sotuvchilar');

  // Leftover words on their own are not understanding — they are the words
  // nothing claimed. "salom qalaysiz" would otherwise report itself back as a
  // successful interpretation.
  const understood =
    intent.categorySlug !== null ||
    intent.regionId !== null ||
    intent.priceMin !== null ||
    intent.priceMax !== null ||
    intent.quantityMin !== null ||
    intent.withDelivery !== null ||
    intent.verifiedOnly !== null;

  if (!understood) {
    return "So'rovni to'liq tushunmadim — so'z bo'yicha qidiraman.";
  }
  return parts.length ? parts.join(' · ') : 'Barcha e’lonlar';
}

function formatNumber(value: number): string {
  return String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}
