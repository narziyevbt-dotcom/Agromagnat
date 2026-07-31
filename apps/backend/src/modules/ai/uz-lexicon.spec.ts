import { matchCategories, normalizeUz, parseFacts } from './uz-lexicon';

describe('normalizeUz', () => {
  it('folds every apostrophe Uzbek is written with into one', () => {
    expect(normalizeUz("O‘rik")).toBe("o'rik");
    expect(normalizeUz("Oʻrik")).toBe("o'rik");
    expect(normalizeUz("O’RIK")).toBe("o'rik");
  });
});

describe('matchCategories', () => {
  it('picks vegetables for a tomato', () => {
    expect(matchCategories('12 tonna pomidor sotiladi')[0].slug).toBe('sabzavotlar');
  });

  it('picks machinery for a tractor, not vegetables', () => {
    const [best] = matchCategories('MTZ-82 traktor sotaman, 2018 yil');
    expect(best.slug).toBe('texnika');
  });

  it('matches through Uzbek suffixes', () => {
    // Agglutinative: "pomidorlarimni" has to hit the same stem as "pomidor".
    expect(matchCategories('pomidorlarimni sotmoqchiman')[0].slug).toBe('sabzavotlar');
  });

  it('handles the other apostrophe characters a phone keyboard produces', () => {
    expect(matchCategories("2 tonna o‘rik bor")[0].slug).toBe('mevalar');
  });

  it('returns nothing when it has no idea, rather than guessing', () => {
    expect(matchCategories('salom qalaysiz')).toEqual([]);
  });

  it('ranks a confident hit above a weak one', () => {
    const results = matchCategories('yuk mashina xizmati, tashib beraman');
    expect(results[0].slug).toBe('xizmatlar');
    expect(results[0].confidence).toBeGreaterThan(0.5);
  });
});

describe('parseFacts', () => {
  it('reads a volume and a price out of one sentence', () => {
    expect(parseFacts("12 tonna pomidor, kilosi 14 ming so'm")).toMatchObject({
      quantity: 12,
      quantityUnit: 't',
      price: 14_000,
      priceUnit: 'kg',
    });
  });

  it('scales millions', () => {
    expect(parseFacts("traktor 85 mln so'm").price).toBe(85_000_000);
  });

  it('does not read the price digits as a volume', () => {
    const facts = parseFacts("500 kg olma, 12 ming so'mdan");
    expect(facts.quantity).toBe(500);
    expect(facts.quantityUnit).toBe('kg');
    expect(facts.price).toBe(12_000);
  });

  it('leaves fields empty rather than inventing them', () => {
    expect(parseFacts('pomidor sotiladi')).toEqual({});
  });

  it('copes with spaced thousands', () => {
    expect(parseFacts("narxi 1 400 000 so'm").price).toBe(1_400_000);
  });
});
