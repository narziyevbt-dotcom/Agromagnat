import { CategoryKind, formSpecFor } from '../catalog/category-forms';
import { SearchContext } from './ai.types';
import { LocalAiService } from './local-ai.service';
import { describeIntent } from './search-intent';

const CATEGORIES = [
  { id: 'c-sabzavot', slug: 'sabzavotlar', nameUz: 'Sabzavotlar' },
  { id: 'c-meva', slug: 'mevalar', nameUz: 'Mevalar' },
  { id: 'c-texnika', slug: 'texnika', nameUz: 'Texnika' },
];

const REGIONS = [
  { id: 'r-samarqand', slug: 'samarqand', nameUz: 'Samarqand' },
  { id: 'r-toshkent-shahri', slug: 'toshkent-shahri', nameUz: 'Toshkent shahri' },
  { id: 'r-toshkent', slug: 'toshkent', nameUz: 'Toshkent' },
];

const context: SearchContext = {
  categories: CATEGORIES,
  regions: REGIONS,
  specFor: () => formSpecFor(CategoryKind.PRODUCE),
  regionId: null,
  districtId: null,
};

describe('LocalAiService.parseSearch', () => {
  const service = new LocalAiService();
  const parse = (text: string) => service.parseSearch(text, context);

  it('reads a product, a region and a price ceiling out of one sentence', async () => {
    const intent = await parse("Samarqanddan kartoshka, 10 mingdan arzon");

    expect(intent.categoryId).toBe('c-sabzavot');
    expect(intent.regionId).toBe('r-samarqand');
    expect(intent.priceMax).toBe(10_000);
    expect(intent.priceMin).toBeNull();
  });

  it('matches a declined region name', async () => {
    // "Samarqanddan", "Samarqandda" — the stem is what has to hit.
    expect((await parse('Samarqandda pomidor')).regionId).toBe('r-samarqand');
    expect((await parse('Samarqanddan pomidor')).regionId).toBe('r-samarqand');
  });

  it('prefers the longer region name when two overlap', async () => {
    // "Toshkent shahri" and "Toshkent" are different places.
    expect((await parse('Toshkent shahridan olma')).regionId).toBe('r-toshkent-shahri');
  });

  it('tells a ceiling from a floor by the word beside the number', async () => {
    expect((await parse("olma 12 mingdan arzon")).priceMax).toBe(12_000);
    expect((await parse("olma 12 mingdan qimmat")).priceMin).toBe(12_000);
  });

  it('reads a range', async () => {
    const intent = await parse('olma 10-15 ming');
    expect(intent.priceMin).toBe(10_000);
    expect(intent.priceMax).toBe(15_000);
  });

  it('reads a wholesale volume floor, not as a price', async () => {
    const intent = await parse("5 tonnadan ko'p kartoshka");
    expect(intent.quantityMin).toBe(5);
    expect(intent.priceMin).toBeNull();
  });

  it('normalises a kilo floor into tonnes, the unit the feed filters on', async () => {
    expect((await parse("500 kg dan ko'p olma")).quantityMin).toBe(0.5);
  });

  it('picks up delivery and verification', async () => {
    const intent = await parse('yetkazib berish bilan tasdiqlangan sotuvchidan pomidor');
    expect(intent.withDelivery).toBe(true);
    expect(intent.verifiedOnly).toBe(true);
  });

  it('sorts by price when the wording asks for it', async () => {
    expect((await parse('arzon pomidor')).sort).toBe('cheapest');
    expect((await parse('qimmat traktor')).sort).toBe('expensive');
    expect((await parse('pomidor')).sort).toBeNull();
  });

  it('keeps unconsumed product words for the full-text index', async () => {
    // "kartoshka" becomes a category; "oq" still has to reach the index or the
    // search silently widens from white potatoes to all potatoes.
    const intent = await parse('oq kartoshka');
    expect(intent.categoryId).toBe('c-sabzavot');
    expect(intent.leftoverQ).toContain('oq');
  });

  it('does not let a delivery phrase outrank the product name', async () => {
    // "yetkazib berish" is a multi-word stem of xizmatlar and outscores a
    // single product word. It was then demoted for ambiguity but kept the top
    // slot, so this query searched services instead of vegetables.
    const intent = await parse('12 mingdan arzon pomidor, yetkazib berish bilan');
    expect(intent.categorySlug).toBe('sabzavotlar');
    expect(intent.withDelivery).toBe(true);
    expect(intent.leftoverQ ?? '').not.toContain('pomidor');
  });

  it('removes a declined region name from the leftover query', async () => {
    // The row says "Samarqand", the buyer typed "Samarqanddan". Leaving the
    // suffix behind sends it to the full-text index, where it matches nothing.
    const intent = await parse('Samarqanddan kartoshka');
    expect(intent.regionId).toBe('r-samarqand');
    expect(intent.leftoverQ ?? '').not.toContain('samarqand');
  });

  it('does not send the act of searching to the full-text index', async () => {
    // "traktor sotib olaman" parsed to the right category and then returned
    // nothing, because "sotib olaman" reached the index and no advert contains
    // it — understood, and answered with an empty market.
    const intent = await parse('traktor sotib olaman');
    expect(intent.categorySlug).toBe('texnika');
    expect(intent.leftoverQ).toBeNull();
  });

  it('invents nothing from a query it cannot read', async () => {
    const intent = await parse('salom qalaysiz');
    expect(intent.categoryId).toBeNull();
    expect(intent.regionId).toBeNull();
    expect(intent.priceMin).toBeNull();
    expect(intent.priceMax).toBeNull();
    expect(intent.quantityMin).toBeNull();
  });

  it('never returns a bare price bound of zero or below', async () => {
    const intent = await parse('0 mingdan arzon pomidor');
    expect(intent.priceMax).toBeNull();
  });
});

describe('describeIntent', () => {
  const base = {
    categoryId: 'c-sabzavot',
    categorySlug: 'sabzavotlar',
    regionId: 'r-samarqand',
    regionName: 'Samarqand',
    priceMin: null,
    priceMax: null,
    quantityMin: null,
    withDelivery: null,
    verifiedOnly: null,
    sort: null,
    leftoverQ: null,
    summaryUz: '',
    source: 'keyword' as const,
  };

  it('names every filter it applied', () => {
    const text = describeIntent({
      ...base,
      priceMax: 10_000,
      quantityMin: 5,
      withDelivery: true,
      leftoverQ: 'oq',
    });

    expect(text).toContain('Samarqand');
    expect(text).toContain('«oq»');
    expect(text).toContain('5 tonnadan');
    expect(text).toContain("10 000 so'mgacha");
    expect(text).toContain('yetkazib');
  });

  it('reads a range as a range rather than two bounds', () => {
    expect(describeIntent({ ...base, priceMin: 10_000, priceMax: 15_000 })).toContain(
      '10 000–15 000',
    );
  });

  it('admits when it understood nothing', () => {
    const text = describeIntent({
      ...base,
      categoryId: null,
      categorySlug: null,
      regionId: null,
      regionName: null,
    });
    expect(text).toContain('tushunmadim');
  });

  it('does not claim to have understood nothing when a category was found', () => {
    // A bare "pomidor" is a successful parse with no extra constraints.
    expect(describeIntent({ ...base, regionId: null, regionName: null })).not.toContain(
      'tushunmadim',
    );
  });
});
