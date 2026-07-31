import { CategoryKind, formSpecFor } from '../catalog/category-forms';
import { DraftContext } from './ai.types';
import { LocalAiService } from './local-ai.service';

const KIND_BY_SLUG: Record<string, CategoryKind> = {
  sabzavotlar: CategoryKind.PRODUCE,
  mevalar: CategoryKind.PRODUCE,
  texnika: CategoryKind.MACHINERY,
  yer: CategoryKind.LAND,
};

const context = (overrides: Partial<DraftContext> = {}): DraftContext => ({
  categories: Object.keys(KIND_BY_SLUG).map((slug) => ({
    id: `id-${slug}`,
    slug,
    nameUz: slug,
  })),
  specFor: (slug) => (KIND_BY_SLUG[slug] ? formSpecFor(KIND_BY_SLUG[slug]) : null),
  regionId: 'region-1',
  districtId: 'district-1',
  ...overrides,
});

describe('LocalAiService', () => {
  const service = new LocalAiService();

  describe('suggestCategory', () => {
    it('resolves a keyword hit to a real category id', async () => {
      const result = await service.suggestCategory('12 tonna pomidor', context());

      expect(result.source).toBe('keyword');
      expect(result.candidates[0]).toMatchObject({
        categoryId: 'id-sabzavotlar',
        slug: 'sabzavotlar',
      });
    });

    it('drops a matched slug that the caller does not actually have', async () => {
      // Categories are seeded data; a deployment missing one must not produce a
      // suggestion pointing at an id that is not there.
      const result = await service.suggestCategory('traktor', context({ categories: [] }));
      expect(result.candidates).toEqual([]);
    });

    it('returns nothing for text it cannot place', async () => {
      expect((await service.suggestCategory('salom', context())).candidates).toEqual([]);
    });
  });

  describe('draftListing', () => {
    it('fills category, volume and price from one sentence', async () => {
      const draft = await service.draftListing(
        "Urgutdan 12 tonna pomidor, kilosi 14 ming so'mdan",
        context(),
      );

      expect(draft.categorySlug).toBe('sabzavotlar');
      expect(draft.quantity).toBe(12);
      expect(draft.quantityUnit).toBe('t');
      expect(draft.price).toBe(14_000);
      expect(draft.missingUz).toEqual([]);
    });

    it('never offers a unit the chosen category rejects', async () => {
      // The whole point of the field spec: a tractor is counted, not weighed.
      const draft = await service.draftListing('MTZ traktor, 500 kg', context());

      expect(draft.categorySlug).toBe('texnika');
      expect(draft.quantityUnit).toBe('dona');
      expect(formSpecFor(CategoryKind.MACHINERY).quantity.units).not.toContain('kg');
    });

    it('lists what the seller still has to fill in', async () => {
      const draft = await service.draftListing(
        'pomidor sotiladi',
        context({ regionId: null, districtId: null }),
      );

      expect(draft.missingUz).toContain('Hajmni kiriting');
      expect(draft.missingUz).toContain('Narxni kiriting');
      expect(draft.missingUz).toContain('Viloyat va tumanni tanlang');
    });

    it('cuts a long title on a word boundary', async () => {
      const draft = await service.draftListing(`${'pomidor '.repeat(40)}`, context());

      expect(draft.title.length).toBeLessThanOrEqual(160);
      expect(draft.title.endsWith('pomido')).toBe(false);
    });

    it('carries the seller saved location through', async () => {
      const draft = await service.draftListing('10 tonna olma', context());
      expect(draft.regionId).toBe('region-1');
      expect(draft.districtId).toBe('district-1');
    });
  });

  describe('assist', () => {
    it('answers a known question from the canned set', async () => {
      const answer = await service.assist("E'lon necha kun turadi?");
      expect(answer.answerUz).toContain('14 kun');
      expect(answer.source).toBe('canned');
    });

    it('falls back rather than inventing an answer', async () => {
      const answer = await service.assist('Marsda pomidor ekish mumkinmi?');
      expect(answer.answerUz).toContain("aniq javob bera olmadim");
    });
  });
});
