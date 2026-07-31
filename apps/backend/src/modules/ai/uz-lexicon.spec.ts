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

  describe('confidence calibration', () => {
    // The web form auto-selects at 0.75 and only offers a chip below it, so
    // these thresholds are load-bearing rather than cosmetic.
    const AUTO_SELECT = 0.75;

    it('is decisive about one clean product name — the commonest input there is', () => {
      // Scoring by number of hits put this at 0.5 and made the single most
      // common case ask the farmer to tap a second time.
      expect(matchCategories('Urgut pomidori, birinchi nav')[0].confidence).toBeGreaterThanOrEqual(
        AUTO_SELECT,
      );
      expect(matchCategories('MTZ-82 traktor')[0].confidence).toBeGreaterThanOrEqual(
        AUTO_SELECT,
      );
      expect(matchCategories('10 tonna kartoshka')[0].confidence).toBeGreaterThanOrEqual(
        AUTO_SELECT,
      );
    });

    it('does not gain much from a longer sentence saying the same thing', () => {
      const short = matchCategories('pomidor')[0].confidence;
      const long = matchCategories(
        'Urgutdan 12 tonna pomidorim bor, sifatli pomidor',
      )[0].confidence;

      expect(Math.abs(long - short)).toBeLessThanOrEqual(0.1);
    });

    it('hedges when two categories genuinely both claim the text', () => {
      // "qovoq" is a vegetable and sits next to the melon vocabulary.
      const results = matchCategories('qovoq va tarvuz sotiladi');
      expect(results.length).toBeGreaterThan(1);
      expect(results[0].confidence).toBeLessThan(AUTO_SELECT);
    });

    it('keeps a short ambiguous stem below the auto-select bar', () => {
      // "yer" is a substring of ordinary words; it must never auto-select.
      const results = matchCategories('yer');
      if (results.length) {
        expect(results[0].confidence).toBeLessThan(AUTO_SELECT);
      }
    });

    it('never exceeds 1', () => {
      for (const text of ['traktor mtz kombayn plug nasos', 'pomidor bodring kartoshka']) {
        for (const match of matchCategories(text)) {
          expect(match.confidence).toBeLessThanOrEqual(1);
          expect(match.confidence).toBeGreaterThan(0);
        }
      }
    });
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
