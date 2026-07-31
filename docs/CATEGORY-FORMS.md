# Category forms

A tractor should not be asked how many kilos it weighs.

Every category carries a `kind`, and each kind expands into a **field spec** —
which unit the volume is measured in, which optional fields apply, and which
extra questions to ask. Clients render the posting form from that spec, and the
API validates against the same one.

## The five kinds

| Kind | Categories | Volume | Also asks |
|---|---|---|---|
| `produce` | mevalar, sabzavotlar, poliz, quruq-meva, don-va-dukkak, kokatlar | kg, t, quti, qop, l, dona | navi, qadoq, yetishtirish |
| `supply` | urug-va-kochat, ogit-va-kimyo, chorva-ozuqasi | kg, qop, dona, l, t, quti | ishlab chiqaruvchi, qadoq og'irligi |
| `machinery` | texnika | **dona only** | holati*, yil, rusumi, ish soati |
| `service` | xizmatlar | xizmat, ga, t | qamrov*, tajriba |
| `land` | yer | **ga only** | turi*, sug'orish*, maqsadi |

`*` required.

Only `produce` gets a harvest date and a season strip; only `produce` and
`supply` get a minimum lot and a wholesale price; `land` gets no delivery
option. Machinery and land have their unit list locked to one value, so the
client renders that select disabled rather than offering a choice of one.

Five kinds rather than twelve per-category specs. One spec per category drifts
the first time somebody adds a category and forgets to write one; with five
buckets a new category only has to answer *which of these is it*, and the
default (`produce`) is the permissive spec — it asks the most and requires none.

## Where each piece lives

- **`categories.kind`** — a column, because it is data. Migration
  `1785620000000-CategoryKinds`.
- **`formSpecFor(kind)`** in `catalog/category-forms.ts` — code, because it is
  presentation. Labels, hints, placeholders and orderings belong with the code
  that changes when the design does, not in rows somebody has to migrate.
- **`listings.attributes`** — `jsonb`, GIN-indexed. A column per field would
  mean a migration every time a category gains a question and would leave eleven
  of twelve categories holding a null.

The spec is expanded on read, not stored: `GET /categories` returns it on every
row, and `GET /categories/:idOrSlug/form` returns one on its own. One of its
bounds (the machinery year ceiling) moves with the calendar, so it is re-derived
even on a cache hit — the categories list itself is cached for an hour, the spec
is not.

## Validation

`ListingsService.resolveAttributes` runs on create and on update and rejects:

- a `quantityUnit` or `priceUnit` outside the category's list
- a `harvestDate` on a category that has none
- a missing required attribute
- a select value outside its options, or a number outside its range

with an Uzbek message naming the category:

```
«Texnika» uchun bu o'lchov birligi mos emas
```

On update the check runs over the **merged** row, not the patch. Moving a
listing into another category has to re-validate the unit and the attributes it
arrived with, which a patch-only check would wave through.

Unknown attribute keys are **dropped, not rejected**. A mobile build one release
behind will keep sending a field the spec has since renamed, and failing the
whole listing over it would break posting for everyone who has not updated. The
normalised bag is what gets stored, so `attributes` only ever holds keys the
spec declares.

## Rendering

`AttributeFields` knows how to draw a select, a number and a text box, and
nothing about what a tractor is. Adding a field is a backend change that reaches
web and mobile on the next API deploy rather than on the next app-store review.

The detail page reads the same spec back through `ListingAttributes`, so a buyer
sees `Holati: Ishlatilgan` rather than `condition: used`.

## Adding a category

1. Add it to `seeds/data/categories.data.ts`.
2. Add its slug to `KIND_BY_SLUG` in `category-forms.ts`.
3. Re-run `npm run seed` — it matches on slug and updates in place.

Step 2 is guarded by a test that asserts every seeded slug has a kind. Skipping
it silently makes the category `produce`, which would ask a tractor for its
picking date.

## Adding a field to a kind

Add an `AttributeDef` to that kind's `attributes` array. That is the whole
change: no migration, no client release, and both the posting form and the
detail page pick it up. Existing listings simply have no value for it, which
renders as absent rather than as empty.
