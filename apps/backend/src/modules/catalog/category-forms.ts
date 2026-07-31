import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PriceUnit, QuantityUnit } from './units';

/**
 * What kind of thing a category sells. This is the one axis the posting form
 * varies on — a tractor and a tonne of tomatoes need genuinely different
 * questions, and asking a machinery seller how many kilos they have is the
 * fastest way to make the form feel like it was written for somebody else.
 *
 * Deliberately five buckets, not twelve. One spec per category would drift out
 * of sync the first time somebody adds a category and forgets the spec; five
 * buckets mean a new category only has to answer "which of these is it".
 */
export enum CategoryKind {
  /** Harvest sold by weight — has a picking date and a season. */
  PRODUCE = 'produce',
  /** Inputs a farmer buys: seed, seedlings, fertiliser, feed. */
  SUPPLY = 'supply',
  /** Tractors, implements, pumps — counted, with a year and a condition. */
  MACHINERY = 'machinery',
  /** Ploughing, transport, spraying — sold as work, not as stock. */
  SERVICE = 'service',
  /** Land for sale or lease, measured in hectares. */
  LAND = 'land',
}

export type AttributeType = 'select' | 'number' | 'text';

/** One category-specific field, rendered by the web and mobile forms alike. */
export class AttributeDef {
  @ApiProperty({ example: 'year' })
  key: string;

  @ApiProperty({ example: 'Ishlab chiqarilgan yil' })
  labelUz: string;

  @ApiProperty({ enum: ['select', 'number', 'text'] })
  type: AttributeType;

  @ApiProperty()
  required: boolean;

  @ApiPropertyOptional({ type: 'array', items: { type: 'object' } })
  options?: Array<{ value: string; labelUz: string }>;

  @ApiPropertyOptional()
  min?: number;

  @ApiPropertyOptional()
  max?: number;

  @ApiPropertyOptional()
  maxLength?: number;

  @ApiPropertyOptional({ description: 'Shown inside the input, after the value' })
  suffixUz?: string;

  @ApiPropertyOptional()
  placeholderUz?: string;
}

/** Which of the always-present optional fields this kind actually asks for. */
export class OptionalFields {
  @ApiProperty() minOrder: boolean;
  @ApiProperty() wholesalePrice: boolean;
  @ApiProperty() harvestDate: boolean;
  @ApiProperty() seasonMonths: boolean;
  @ApiProperty() delivery: boolean;
}

export class QuantitySpec {
  @ApiProperty({ example: 'Hajm' }) labelUz: string;
  @ApiProperty({ example: "Sotuvga tayyor umumiy hajm" }) hintUz: string;
  @ApiProperty({ enum: QuantityUnit, isArray: true }) units: QuantityUnit[];
  @ApiProperty({ example: '12' }) placeholder: string;
}

export class PriceSpec {
  @ApiProperty({ example: 'Narx' }) labelUz: string;
  @ApiProperty({ example: "1 kg uchun so'mda" }) hintUz: string;
  @ApiProperty({ enum: PriceUnit, isArray: true }) units: PriceUnit[];
  @ApiProperty({ example: '14000' }) placeholder: string;
}

/** The complete description of a posting form, one per category kind. */
export class CategoryFormSpec {
  @ApiProperty({ enum: CategoryKind }) kind: CategoryKind;
  @ApiProperty({ type: QuantitySpec }) quantity: QuantitySpec;
  @ApiProperty({ type: PriceSpec }) price: PriceSpec;
  @ApiProperty({ type: OptionalFields }) optional: OptionalFields;
  @ApiProperty({ type: [AttributeDef] }) attributes: AttributeDef[];
}

/**
 * Which bucket each seeded category falls in. Anything not listed is produce,
 * which is the safe default: it asks the most questions, all of them optional.
 */
export const KIND_BY_SLUG: Record<string, CategoryKind> = {
  mevalar: CategoryKind.PRODUCE,
  sabzavotlar: CategoryKind.PRODUCE,
  poliz: CategoryKind.PRODUCE,
  'quruq-meva': CategoryKind.PRODUCE,
  'don-va-dukkak': CategoryKind.PRODUCE,
  kokatlar: CategoryKind.PRODUCE,
  'urug-va-kochat': CategoryKind.SUPPLY,
  'ogit-va-kimyo': CategoryKind.SUPPLY,
  'chorva-ozuqasi': CategoryKind.SUPPLY,
  texnika: CategoryKind.MACHINERY,
  xizmatlar: CategoryKind.SERVICE,
  yer: CategoryKind.LAND,
};

const CONDITION = [
  { value: 'new', labelUz: 'Yangi' },
  { value: 'used', labelUz: 'Ishlatilgan' },
];

/**
 * The year field's ceiling has to move with the calendar, so the specs are
 * built per call rather than frozen at import. They are small and pure, and the
 * catalog response that carries them is cached for an hour anyway.
 */
export function formSpecFor(kind: CategoryKind): CategoryFormSpec {
  const nextYear = new Date().getFullYear() + 1;

  switch (kind) {
    case CategoryKind.MACHINERY:
      return {
        kind,
        quantity: {
          labelUz: 'Nechta',
          hintUz: "Sotuvdagi texnika soni",
          units: [QuantityUnit.PIECE],
          placeholder: '1',
        },
        price: {
          labelUz: 'Narx',
          hintUz: "Bittasi uchun so'mda",
          units: [PriceUnit.PIECE],
          placeholder: '85000000',
        },
        optional: {
          minOrder: false,
          wholesalePrice: false,
          harvestDate: false,
          seasonMonths: false,
          delivery: true,
        },
        attributes: [
          {
            key: 'condition',
            labelUz: 'Holati',
            type: 'select',
            required: true,
            options: CONDITION,
          },
          {
            key: 'year',
            labelUz: 'Ishlab chiqarilgan yil',
            type: 'number',
            required: false,
            min: 1950,
            max: nextYear,
            placeholderUz: '2018',
          },
          {
            key: 'brand',
            labelUz: 'Rusumi',
            type: 'text',
            required: false,
            maxLength: 60,
            placeholderUz: 'MTZ-82',
          },
          {
            key: 'hours',
            labelUz: 'Ish soati',
            type: 'number',
            required: false,
            min: 0,
            max: 200_000,
            suffixUz: 'soat',
          },
        ],
      };

    case CategoryKind.SERVICE:
      return {
        kind,
        quantity: {
          labelUz: 'Hajm',
          hintUz: "Bir mavsumda bajara oladigan hajmingiz",
          units: [QuantityUnit.SERVICE, QuantityUnit.HECTARE, QuantityUnit.TON],
          placeholder: '50',
        },
        price: {
          labelUz: 'Narx',
          hintUz: "Bir birlik ish uchun so'mda",
          units: [PriceUnit.SERVICE, PriceUnit.HECTARE, PriceUnit.TON, PriceUnit.KG],
          placeholder: '400000',
        },
        optional: {
          minOrder: true,
          wholesalePrice: false,
          harvestDate: false,
          seasonMonths: true,
          delivery: false,
        },
        attributes: [
          {
            key: 'coverage',
            labelUz: 'Qamrov',
            type: 'select',
            required: true,
            options: [
              { value: 'district', labelUz: 'Tuman ichida' },
              { value: 'region', labelUz: 'Viloyat bo‘ylab' },
              { value: 'country', labelUz: "Respublika bo‘ylab" },
            ],
          },
          {
            key: 'experienceYears',
            labelUz: 'Tajriba',
            type: 'number',
            required: false,
            min: 0,
            max: 70,
            suffixUz: 'yil',
          },
        ],
      };

    case CategoryKind.LAND:
      return {
        kind,
        quantity: {
          labelUz: 'Maydon',
          hintUz: 'Yer maydoni gektarda',
          units: [QuantityUnit.HECTARE],
          placeholder: '4.5',
        },
        price: {
          labelUz: 'Narx',
          hintUz: "1 gektar uchun so'mda",
          units: [PriceUnit.HECTARE],
          placeholder: '120000000',
        },
        optional: {
          minOrder: false,
          wholesalePrice: false,
          harvestDate: false,
          seasonMonths: false,
          delivery: false,
        },
        attributes: [
          {
            key: 'tenure',
            labelUz: 'Turi',
            type: 'select',
            required: true,
            options: [
              { value: 'sale', labelUz: 'Sotuv' },
              { value: 'lease', labelUz: 'Ijara' },
            ],
          },
          {
            key: 'irrigation',
            labelUz: 'Sug‘orish',
            type: 'select',
            required: true,
            options: [
              { value: 'yes', labelUz: 'Suv bor' },
              { value: 'no', labelUz: "Suv yo‘q" },
            ],
          },
          {
            key: 'purpose',
            labelUz: 'Maqsadi',
            type: 'select',
            required: false,
            options: [
              { value: 'field', labelUz: 'Dehqonchilik' },
              { value: 'orchard', labelUz: 'Bog‘' },
              { value: 'greenhouse', labelUz: 'Issiqxona' },
              { value: 'pasture', labelUz: "Yaylov" },
            ],
          },
        ],
      };

    case CategoryKind.SUPPLY:
      return {
        kind,
        quantity: {
          labelUz: 'Miqdor',
          hintUz: 'Omborda turgan miqdor',
          units: [
            QuantityUnit.KG,
            QuantityUnit.BAG,
            QuantityUnit.PIECE,
            QuantityUnit.LITER,
            QuantityUnit.TON,
            QuantityUnit.BOX,
          ],
          placeholder: '200',
        },
        price: {
          labelUz: 'Narx',
          hintUz: "Bir birlik uchun so'mda",
          units: [
            PriceUnit.KG,
            PriceUnit.BAG,
            PriceUnit.PIECE,
            PriceUnit.LITER,
            PriceUnit.TON,
            PriceUnit.BOX,
          ],
          placeholder: '35000',
        },
        optional: {
          minOrder: true,
          wholesalePrice: true,
          harvestDate: false,
          seasonMonths: false,
          delivery: true,
        },
        attributes: [
          {
            key: 'brand',
            labelUz: 'Ishlab chiqaruvchi',
            type: 'text',
            required: false,
            maxLength: 60,
            placeholderUz: 'Agrokimyo',
          },
          {
            key: 'packWeight',
            labelUz: 'Qadoq og‘irligi',
            type: 'text',
            required: false,
            maxLength: 30,
            placeholderUz: '50 kg',
          },
        ],
      };

    case CategoryKind.PRODUCE:
    default:
      return {
        kind: CategoryKind.PRODUCE,
        quantity: {
          labelUz: 'Hajm',
          hintUz: 'Sotuvga tayyor umumiy hajm',
          units: [
            QuantityUnit.KG,
            QuantityUnit.TON,
            QuantityUnit.BOX,
            QuantityUnit.BAG,
            QuantityUnit.LITER,
            QuantityUnit.PIECE,
          ],
          placeholder: '12',
        },
        price: {
          labelUz: 'Narx',
          hintUz: "1 birlik uchun so'mda",
          units: [
            PriceUnit.KG,
            PriceUnit.TON,
            PriceUnit.BOX,
            PriceUnit.BAG,
            PriceUnit.LITER,
            PriceUnit.PIECE,
          ],
          placeholder: '14000',
        },
        optional: {
          minOrder: true,
          wholesalePrice: true,
          harvestDate: true,
          seasonMonths: true,
          delivery: true,
        },
        attributes: [
          {
            key: 'grade',
            labelUz: 'Navi',
            type: 'select',
            required: false,
            options: [
              { value: 'first', labelUz: '1-nav' },
              { value: 'second', labelUz: '2-nav' },
              { value: 'third', labelUz: '3-nav' },
            ],
          },
          {
            key: 'packaging',
            labelUz: 'Qadoq',
            type: 'select',
            required: false,
            options: [
              { value: 'box', labelUz: 'Quti' },
              { value: 'bag', labelUz: 'Qop' },
              { value: 'crate', labelUz: 'Yashik' },
              { value: 'pallet', labelUz: 'Palet' },
              { value: 'bulk', labelUz: 'Qadoqsiz' },
            ],
          },
          {
            key: 'organic',
            labelUz: 'Yetishtirish',
            type: 'select',
            required: false,
            options: [
              { value: 'organic', labelUz: 'Kimyosiz' },
              { value: 'standard', labelUz: 'Odatiy' },
            ],
          },
        ],
      };
  }
}

export type ListingAttributes = Record<string, string | number>;

/**
 * Checks a submitted attribute bag against its category's spec and returns it
 * normalised — unknown keys dropped, numbers coerced, blanks removed.
 *
 * Dropping unknown keys rather than rejecting them is deliberate: a mobile
 * build one release behind will keep posting a field the spec has since
 * renamed, and refusing the whole listing over it would break posting for
 * everyone who has not updated.
 */
export function validateAttributes(
  spec: CategoryFormSpec,
  raw: unknown,
): { value: ListingAttributes; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const value: ListingAttributes = {};
  const input = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;

  for (const def of spec.attributes) {
    const given = input[def.key];
    const isBlank = given === undefined || given === null || given === '';

    if (isBlank) {
      if (def.required) {
        errors[def.key] = `${def.labelUz} tanlanmagan`;
      }
      continue;
    }

    if (def.type === 'select') {
      const match = def.options?.find((option) => option.value === String(given));
      if (!match) {
        errors[def.key] = `${def.labelUz} noto‘g‘ri`;
        continue;
      }
      value[def.key] = match.value;
      continue;
    }

    if (def.type === 'number') {
      const parsed = Number(given);
      if (!Number.isFinite(parsed)) {
        errors[def.key] = `${def.labelUz} raqam bo‘lishi kerak`;
        continue;
      }
      if (def.min !== undefined && parsed < def.min) {
        errors[def.key] = `${def.labelUz} ${def.min} dan kichik bo‘lmasin`;
        continue;
      }
      if (def.max !== undefined && parsed > def.max) {
        errors[def.key] = `${def.labelUz} ${def.max} dan katta bo‘lmasin`;
        continue;
      }
      value[def.key] = parsed;
      continue;
    }

    const text = String(given).trim();
    if (!text) continue;
    if (def.maxLength && text.length > def.maxLength) {
      errors[def.key] = `${def.labelUz} juda uzun`;
      continue;
    }
    value[def.key] = text;
  }

  return { value, errors };
}
