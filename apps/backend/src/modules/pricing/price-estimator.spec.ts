import { PriceBasis } from './dto/pricing.dto';
import {
  confidenceOf,
  explainUz,
  formatSom,
  lotAdjustment,
  MIN_SAMPLE,
  PriceSample,
} from './price-estimator';

const sample = (overrides: Partial<PriceSample> = {}): PriceSample => ({
  p25: 12_000,
  median: 14_000,
  p75: 16_000,
  count: 40,
  ...overrides,
});

describe('confidenceOf', () => {
  it('is zero below the minimum sample, however tight the prices', () => {
    expect(confidenceOf(sample({ count: MIN_SAMPLE - 1 }), PriceBasis.SOLD_LOCAL)).toBe(0);
  });

  it('is zero for a nonsensical median rather than dividing by it', () => {
    expect(confidenceOf(sample({ median: 0 }), PriceBasis.SOLD_LOCAL)).toBe(0);
  });

  it('trusts local sales more than national sales', () => {
    expect(confidenceOf(sample(), PriceBasis.SOLD_LOCAL)).toBeGreaterThan(
      confidenceOf(sample(), PriceBasis.SOLD_NATIONAL),
    );
  });

  it('trusts a sale more than an asking price', () => {
    // An asking price is an opinion; a sale is a fact.
    expect(confidenceOf(sample(), PriceBasis.SOLD_LOCAL)).toBeGreaterThan(
      confidenceOf(sample(), PriceBasis.ACTIVE_LOCAL),
    );
  });

  it('rises with sample size', () => {
    expect(confidenceOf(sample({ count: 40 }), PriceBasis.SOLD_LOCAL)).toBeGreaterThan(
      confidenceOf(sample({ count: 6 }), PriceBasis.SOLD_LOCAL),
    );
  });

  it('falls when prices are scattered, at the same sample size', () => {
    const tight = confidenceOf(sample({ p25: 13_500, p75: 14_500 }), PriceBasis.SOLD_LOCAL);
    const wide = confidenceOf(sample({ p25: 4_000, p75: 40_000 }), PriceBasis.SOLD_LOCAL);

    expect(tight).toBeGreaterThan(wide);
    // Scattered enough and the population is not really one market.
    expect(wide).toBeLessThan(0.35);
  });

  it('stays inside [0, 1] at the extremes', () => {
    const best = confidenceOf(
      sample({ count: 100_000, p25: 14_000, p75: 14_000 }),
      PriceBasis.SOLD_LOCAL,
    );
    expect(best).toBeLessThanOrEqual(1);
    expect(best).toBeGreaterThan(0.9);

    expect(
      confidenceOf(sample({ p25: 1, p75: 10_000_000 }), PriceBasis.ACTIVE_NATIONAL),
    ).toBeGreaterThanOrEqual(0);
  });
});

describe('lotAdjustment', () => {
  it('leaves a retail quantity at the median', () => {
    expect(lotAdjustment(50, 14_000)).toBe(14_000);
    expect(lotAdjustment(undefined, 14_000)).toBe(14_000);
  });

  it('discounts a large lot, because wholesale is cheaper per unit', () => {
    expect(lotAdjustment(5_000, 14_000)).toBeLessThan(14_000);
    expect(lotAdjustment(50_000, 14_000)).toBeLessThan(lotAdjustment(5_000, 14_000));
  });

  it('never discounts by more than a tenth — it is a hint, not a pricing model', () => {
    expect(lotAdjustment(10_000_000, 14_000)).toBeGreaterThan(14_000 * 0.9);
  });

  it('ignores a nonsensical quantity instead of inverting the price', () => {
    expect(lotAdjustment(-5, 14_000)).toBe(14_000);
    expect(lotAdjustment(0, 14_000)).toBe(14_000);
  });
});

describe('formatSom', () => {
  it('groups thousands with a space, the way the audience reads them', () => {
    expect(formatSom(14_000)).toBe('14 000');
    expect(formatSom(1_400_000)).toBe('1 400 000');
    expect(formatSom(950)).toBe('950');
  });

  it('rounds rather than printing a fractional so\'m', () => {
    expect(formatSom(13_499.6)).toBe('13 500');
  });
});

describe('explainUz', () => {
  const base = {
    basis: PriceBasis.SOLD_LOCAL,
    suggested: 13_500,
    unit: 'kg',
    sampleSize: 34,
    confidence: 0.8,
    trendPct: null as number | null,
  };

  it('names the basis, the number and the sample', () => {
    const text = explainUz(base);
    expect(text).toContain('hududingizdagi sotuvlarga ko‘ra');
    expect(text).toContain('13 500');
    expect(text).toContain('34');
  });

  it('mentions a meaningful move and stays quiet about noise', () => {
    expect(explainUz({ ...base, trendPct: -12 })).toContain('tushgan');
    expect(explainUz({ ...base, trendPct: 12 })).toContain("ko‘tarilgan");
    expect(explainUz({ ...base, trendPct: 1.4 })).not.toContain('tushgan');
  });

  it('admits when the estimate is weak', () => {
    // A hedge the seller can see beats a confident number built on six rows.
    expect(explainUz({ ...base, confidence: 0.3 })).toContain('taxminiy');
    expect(explainUz({ ...base, confidence: 0.8 })).not.toContain('taxminiy');
  });

  it('says which unit the price is per', () => {
    expect(explainUz({ ...base, unit: 't' })).toContain('tonna');
    expect(explainUz({ ...base, unit: 'dona' })).toContain('dona');
  });

  it('ends in a single full stop whatever clauses were included', () => {
    for (const trendPct of [null, -12, 1]) {
      for (const confidence of [0.3, 0.9]) {
        const text = explainUz({ ...base, trendPct, confidence });
        expect(text.endsWith('.')).toBe(true);
        expect(text).not.toContain('..');
        expect(text).not.toContain(' .');
      }
    }
  });
});
