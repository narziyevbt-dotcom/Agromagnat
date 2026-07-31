/**
 * The measurement units, kept apart from the entities that use them.
 *
 * They used to live on `Category` and `Listing` respectively, which was fine
 * until the posting-form spec needed both: the spec is imported by
 * `category.entity`, and importing the entities back would close a cycle that
 * leaves one of the two enums undefined at decorator-evaluation time. Units
 * depend on nothing, so this file is the natural bottom of the graph.
 *
 * Both entities re-export their own, so every existing import still resolves.
 */

/** Measurement unit a listing's quantity is expressed in. */
export enum QuantityUnit {
  KG = 'kg',
  TON = 't',
  PIECE = 'dona',
  BOX = 'quti',
  BAG = 'qop',
  LITER = 'l',
  HECTARE = 'ga',
  SERVICE = 'xizmat',
}

/**
 * Unit the price is quoted per — "12 000 so'm/kg". Deliberately a separate
 * enum from `QuantityUnit` even though the members coincide today: a listing
 * priced per kilo can be sold by the tonne, and collapsing the two would make
 * that distinction unexpressible.
 */
export enum PriceUnit {
  KG = 'kg',
  TON = 't',
  PIECE = 'dona',
  BOX = 'quti',
  BAG = 'qop',
  LITER = 'l',
  HECTARE = 'ga',
  SERVICE = 'xizmat',
}
