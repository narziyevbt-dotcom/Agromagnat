import { PriceBasis } from './dto/pricing.dto';

/**
 * The price recommendation, as arithmetic.
 *
 * This is deliberately not a model call. A price recommendation is the number a
 * farmer sets their livelihood by, and a language model asked "what should
 * tomatoes cost in Samarqand this week" will produce a confident, plausible,
 * unfalsifiable answer with nothing behind it. What we have instead is real
 * data — what listings in this category actually sold for, in this region, in
 * the last two months — and percentiles over that are both more accurate and
 * defensible to a seller who disagrees.
 *
 * The model's job in this feature is downstream and narrow: turning the numbers
 * below into a sentence. It never chooses the number. See docs/PRICING.md.
 */

/** A raw sample drawn from the database, already scoped and unit-matched. */
export interface PriceSample {
  p25: number;
  median: number;
  p75: number;
  count: number;
}

/** Minimum rows before a population is worth reporting at all. */
export const MIN_SAMPLE = 5;

/**
 * How much each basis is trusted before sample size and spread are considered.
 *
 * Sold prices beat asking prices because an asking price is an opinion and a
 * sale is a fact — half the active listings on any classifieds board are priced
 * where they will never clear. Local beats national because transport across
 * Uzbekistan is a real cost and a Samarqand tomato is not a Nukus tomato.
 */
const BASIS_WEIGHT: Record<PriceBasis, number> = {
  [PriceBasis.SOLD_LOCAL]: 1,
  [PriceBasis.SOLD_NATIONAL]: 0.8,
  [PriceBasis.ACTIVE_LOCAL]: 0.72,
  [PriceBasis.ACTIVE_NATIONAL]: 0.55,
};

/** Sample size at which the count stops adding confidence. */
const SATURATION = 40;

/**
 * Confidence in [0, 1], from three independent penalties.
 *
 * Reporting a bare median with no confidence would be the dishonest version of
 * this feature: five scattered listings and four hundred tight ones produce the
 * same number and deserve very different trust. The UI uses this to decide
 * between "bozor narxi" and "taxminan".
 */
export function confidenceOf(sample: PriceSample, basis: PriceBasis): number {
  if (sample.count < MIN_SAMPLE || sample.median <= 0) return 0;

  // Sample size, with diminishing returns — the 41st listing tells you far less
  // than the 6th. sqrt rather than linear for that reason.
  const size = Math.min(1, Math.sqrt(sample.count / SATURATION));

  // Dispersion: the interquartile range as a fraction of the median. A tight
  // market (IQR under a third of the median) is fully trusted; beyond 1.5x the
  // prices are telling us the population is not really one market.
  const spread = (sample.p75 - sample.p25) / sample.median;
  const tightness = spread <= 0.33 ? 1 : Math.max(0, 1 - (spread - 0.33) / 1.2);

  const raw = BASIS_WEIGHT[basis] * size * tightness;
  return Math.round(Math.min(1, Math.max(0, raw)) * 100) / 100;
}

/**
 * Nudges the median for lot size.
 *
 * Wholesale is cheaper per unit — that is the entire reason a buyer takes ten
 * tonnes instead of ten kilos — so recommending the median to somebody selling
 * a very large lot would price them out of the market they are actually in.
 * The adjustment is small and capped: it is a hint, not a pricing model, and
 * overreaching here produces a number the seller can see is wrong.
 */
export function lotAdjustment(quantity: number | undefined, median: number): number {
  if (!quantity || quantity <= 0) return median;
  if (quantity >= 10_000) return median * 0.92;
  if (quantity >= 1_000) return median * 0.96;
  return median;
}

const BASIS_PHRASE: Record<PriceBasis, string> = {
  [PriceBasis.SOLD_LOCAL]: 'hududingizdagi sotuvlarga ko‘ra',
  [PriceBasis.SOLD_NATIONAL]: 'respublika bo‘ylab sotuvlarga ko‘ra',
  [PriceBasis.ACTIVE_LOCAL]: 'hududingizdagi joriy e’lonlarga ko‘ra',
  [PriceBasis.ACTIVE_NATIONAL]: 'respublika bo‘ylab joriy e’lonlarga ko‘ra',
};

const UNIT_LABEL: Record<string, string> = {
  kg: 'kg',
  t: 'tonna',
  dona: 'dona',
  quti: 'quti',
  qop: 'qop',
  l: 'litr',
  ga: 'gektar',
  xizmat: 'xizmat',
};

/** "13 500" — a thousands separator a farmer reads, not `toLocaleString`. */
export function formatSom(value: number): string {
  return Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/**
 * The one sentence the seller reads.
 *
 * Written from the numbers rather than by a model on purpose: it is rendered on
 * every keystroke of the price field, it must be identical for identical
 * inputs, and it must never be able to disagree with the figures beside it.
 */
export function explainUz(input: {
  basis: PriceBasis;
  suggested: number;
  unit: string;
  sampleSize: number;
  confidence: number;
  trendPct: number | null;
}): string {
  const unit = UNIT_LABEL[input.unit] ?? input.unit;
  const parts = [
    `${BASIS_PHRASE[input.basis]} ${formatSom(input.suggested)} so‘m/${unit} atrofida`,
    `(${input.sampleSize} ta e’lon)`,
  ];

  if (input.trendPct !== null && Math.abs(input.trendPct) >= 3) {
    parts.push(
      input.trendPct > 0
        ? `— narx oyiga nisbatan ${Math.abs(Math.round(input.trendPct))}% ko‘tarilgan`
        : `— narx oyiga nisbatan ${Math.abs(Math.round(input.trendPct))}% tushgan`,
    );
  }

  // Say so when the estimate is weak. A hedge the seller can see is worth more
  // than a confident number they later discover was built on six listings.
  if (input.confidence < 0.5) {
    parts.push('. Ma’lumot kam — taxminiy');
  }

  return `${parts.join(' ').replace(' .', '.')}.`.replace('..', '.');
}

/** The message shown when no population cleared `MIN_SAMPLE`. */
export const NO_DATA_UZ =
  'Bu kategoriya bo‘yicha hozircha yetarli ma’lumot yo‘q — narxni o‘zingiz belgilang.';
