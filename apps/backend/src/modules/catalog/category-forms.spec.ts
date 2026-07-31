import { CategoryKind, formSpecFor, KIND_BY_SLUG, validateAttributes } from './category-forms';

describe('category form specs', () => {
  it('never asks a machinery listing for a weight', () => {
    const spec = formSpecFor(CategoryKind.MACHINERY);

    expect(spec.quantity.units).not.toContain('kg');
    expect(spec.quantity.units).not.toContain('t');
    expect(spec.quantity.labelUz).toBe('Nechta');
    expect(spec.optional.harvestDate).toBe(false);
    expect(spec.optional.seasonMonths).toBe(false);
  });

  it('keeps the harvest date and season on produce, where they mean something', () => {
    const spec = formSpecFor(CategoryKind.PRODUCE);

    expect(spec.optional.harvestDate).toBe(true);
    expect(spec.optional.seasonMonths).toBe(true);
    expect(spec.quantity.units).toContain('kg');
  });

  it('measures land in hectares only', () => {
    expect(formSpecFor(CategoryKind.LAND).quantity.units).toEqual(['ga']);
    expect(formSpecFor(CategoryKind.LAND).price.units).toEqual(['ga']);
  });

  it('moves the year ceiling with the calendar', () => {
    const year = formSpecFor(CategoryKind.MACHINERY).attributes.find((a) => a.key === 'year');
    expect(year!.max).toBe(new Date().getFullYear() + 1);
  });

  it('maps every seeded category to a kind', () => {
    // Guards the seed: a category added without a kind silently becomes
    // produce, which would ask a tractor for its picking date.
    expect(Object.keys(KIND_BY_SLUG)).toHaveLength(12);
    for (const kind of Object.values(KIND_BY_SLUG)) {
      expect(Object.values(CategoryKind)).toContain(kind);
    }
  });
});

describe('validateAttributes', () => {
  const machinery = formSpecFor(CategoryKind.MACHINERY);

  it('accepts a well-formed bag and coerces numbers', () => {
    const { value, errors } = validateAttributes(machinery, {
      condition: 'used',
      year: '2018',
      brand: '  MTZ-82  ',
    });

    expect(errors).toEqual({});
    expect(value).toEqual({ condition: 'used', year: 2018, brand: 'MTZ-82' });
  });

  it('demands the required select', () => {
    const { errors } = validateAttributes(machinery, { year: 2018 });
    expect(errors.condition).toBe('Holati tanlanmagan');
  });

  it('rejects a select value outside the option list', () => {
    const { errors } = validateAttributes(machinery, { condition: 'broken' });
    expect(errors.condition).toContain('Holati');
  });

  it('enforces the numeric bounds', () => {
    expect(
      validateAttributes(machinery, { condition: 'new', year: 1899 }).errors.year,
    ).toContain('1950');
    expect(
      validateAttributes(machinery, { condition: 'new', year: 4000 }).errors.year,
    ).toBeDefined();
  });

  it('drops keys the spec does not declare rather than failing the listing', () => {
    // A mobile build one release behind will keep sending a renamed field;
    // rejecting the whole listing over it would break posting for everyone.
    const { value, errors } = validateAttributes(machinery, {
      condition: 'new',
      horsepower: 80,
    });

    expect(errors).toEqual({});
    expect(value).toEqual({ condition: 'new' });
  });

  it('treats a missing bag as an empty one', () => {
    expect(validateAttributes(formSpecFor(CategoryKind.PRODUCE), undefined).value).toEqual({});
    expect(validateAttributes(formSpecFor(CategoryKind.PRODUCE), null).errors).toEqual({});
  });
});
