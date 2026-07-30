import { QuantityUnit } from '../../../modules/catalog/entities/category.entity';

export interface CategorySeed {
  nameUz: string;
  nameRu: string;
  slug: string;
  icon: string;
  unitDefault: QuantityUnit;
  /** The first 8 fill the Home icon grid; the rest live behind "Barchasi". */
  isFeatured: boolean;
}

/** The 12 agro categories from the product spec, in Home-grid order. */
export const CATEGORIES: CategorySeed[] = [
  {
    nameUz: 'Mevalar',
    nameRu: 'Фрукты',
    slug: 'mevalar',
    icon: 'apple',
    unitDefault: QuantityUnit.KG,
    isFeatured: true,
  },
  {
    nameUz: 'Sabzavotlar',
    nameRu: 'Овощи',
    slug: 'sabzavotlar',
    icon: 'carrot',
    unitDefault: QuantityUnit.KG,
    isFeatured: true,
  },
  {
    nameUz: 'Poliz',
    nameRu: 'Бахчевые',
    slug: 'poliz',
    icon: 'melon',
    unitDefault: QuantityUnit.KG,
    isFeatured: true,
  },
  {
    nameUz: 'Quruq meva',
    nameRu: 'Сухофрукты',
    slug: 'quruq-meva',
    icon: 'raisin',
    unitDefault: QuantityUnit.KG,
    isFeatured: true,
  },
  {
    nameUz: 'Don va dukkak',
    nameRu: 'Зерно и бобовые',
    slug: 'don-va-dukkak',
    icon: 'wheat',
    unitDefault: QuantityUnit.TON,
    isFeatured: true,
  },
  {
    nameUz: "Ko'katlar",
    nameRu: 'Зелень',
    slug: 'kokatlar',
    icon: 'herb',
    unitDefault: QuantityUnit.KG,
    isFeatured: true,
  },
  {
    nameUz: "Urug' va ko'chat",
    nameRu: 'Семена и саженцы',
    slug: 'urug-va-kochat',
    icon: 'seedling',
    unitDefault: QuantityUnit.PIECE,
    isFeatured: true,
  },
  {
    nameUz: "O'g'it va kimyo",
    nameRu: 'Удобрения и химия',
    slug: 'ogit-va-kimyo',
    icon: 'fertilizer',
    unitDefault: QuantityUnit.BAG,
    isFeatured: true,
  },
  {
    nameUz: 'Texnika',
    nameRu: 'Техника',
    slug: 'texnika',
    icon: 'tractor',
    unitDefault: QuantityUnit.PIECE,
    isFeatured: false,
  },
  {
    nameUz: 'Chorva ozuqasi',
    nameRu: 'Корма для скота',
    slug: 'chorva-ozuqasi',
    icon: 'hay',
    unitDefault: QuantityUnit.TON,
    isFeatured: false,
  },
  {
    nameUz: 'Xizmatlar',
    nameRu: 'Услуги',
    slug: 'xizmatlar',
    icon: 'truck',
    unitDefault: QuantityUnit.SERVICE,
    isFeatured: false,
  },
  {
    nameUz: 'Yer',
    nameRu: 'Земля',
    slug: 'yer',
    icon: 'field',
    unitDefault: QuantityUnit.HECTARE,
    isFeatured: false,
  },
];
