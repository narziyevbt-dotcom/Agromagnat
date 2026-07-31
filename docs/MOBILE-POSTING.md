# Posting a listing — mobile

A tractor is never asked how many kilos it weighs.

## The form is not written here

Every category carries a `kind`, and each kind expands into a field spec: which
units the volume may use, which optional fields apply, which extra questions to
ask. `GET /categories` returns that spec on every row and the client renders it.
See [CATEGORY-FORMS.md](CATEGORY-FORMS.md) for the backend side.

`AttributeFields` knows how to draw a select, a number and a text box, and
nothing about what a tractor is. Adding a question is a backend change that
reaches this screen on the next API deploy rather than the next store review.

`FormSpecFixtures.forKind` mirrors the backend's `formSpecFor` while the API is
still mocked — a mirror rather than a simplification, because a mock returning
one generic spec would let a form ship that has never been asked to lock a unit
select or draw a required attribute.

What that buys, concretely:

| | produce | machinery | land |
|---|---|---|---|
| Volume label | Hajm | **Nechta** | **Maydon** |
| Units | kg, t, quti, qop, l, dona | **dona only** | **ga only** |
| Picking date | yes | no | no |
| Minimum lot | yes | no | no |
| Delivery | yes | yes | **no** |
| Own questions | navi, qadoq, yetishtirish | holati\*, yil, rusumi, ish soati | turi\*, sug'orish\*, maqsadi |

`*` required. A kind whose unit list has one entry renders that select
**locked** rather than as a choice of one — a control that looks interactive
and is not is worse than no control.

## One scroll, not a wizard

A four-step flow looks tidier but hides how much is left, and turns "go back
and fix the volume" into a navigation problem. A farmer standing in a field
wants the whole form visible and fills it in whatever order the answers come.

Other decisions worth keeping:

- **Errors appear only after the first submit.** Showing them as the seller
  types turns a blank form into a wall of red. After that they update per
  field, so a fixed one disappears while the others stay.
- **Every missing field is reported at once**, not the first one. Discovering a
  form one rejection at a time is expensive on a connection billed per request.
- **The client validates before sending** so a farmer on EDGE finds out without
  spending a round trip — but the server's answer wins, and it comes back in
  the same field-keyed shape, so the form has one error path rather than two.
- **Selects are chips, not dropdowns.** Every option list here is short, and a
  chip row shows all of them at once on a screen held at arm's length.
- **Number fields accept a comma** — that is what an Uzbek keyboard produces
  for a decimal separator.

## Switching category

`ListingDraft.withCategory` drops whatever the new category does not ask:
harvest date, minimum lot, wholesale price, delivery, and any attribute the new
spec never declared. Carrying them across is how a tractor ends up with a
picking date — the API rejects it, but only after the whole form is filled in.

A **number survives only while its unit does**. Moving 12 t of tomatoes into
machinery would silently become 12 tractors: a legal value, and nothing like
what the seller typed. Moving between two produce categories keeps both, since
the unit is still legal there.

The form widgets are keyed on the category id so they rebuild rather than
reuse. Without that the previous category's typed text stays on screen while
the draft behind it has already been cleared.

## Tests

31 tests across `listing_draft_test.dart` (the rules) and
`add_listing_screen_test.dart` (the screen obeying them).

The screen tests pump on a 1000×4000 surface. The form lives in a `ListView`,
which only builds what is on screen, and on the default 800×600 `findsNothing`
becomes meaningless — a field could be absent because the spec omitted it or
because it is below the fold. These tests turn entirely on telling those apart.

Writing them surfaced the unit/number rule above: the screen kept a typed `12`
across a switch into machinery, and the test that objected was right.

## Not done yet

- **Photos.** The listing model carries them and the card renders them; there
  is no picker or upload, which needs `image_picker` plus the S3 presign flow.
- **Voice-first posting.** The product rule is a mic on this screen that
  transcribes and fills the whole form (`POST /ai/draft` returns values plus
  `missingUz`; AI drafts, it never publishes). That needs audio recording — a
  native plugin and a permissions story — plus the AI endpoint, so it is its
  own slice on top of this one.
- **Draft persistence.** `shared_preferences` is already a dependency for
  exactly this: a half-filled form should survive the app being killed on a
  weak connection. Nothing writes to it yet.
