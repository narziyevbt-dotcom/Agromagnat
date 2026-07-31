# AI

Three things a seller can ask for: which category this belongs in, a listing
written from one sentence, and an answer to a question about selling here.

All three sit behind one interface, `AiService`, with two implementations. The
choice is made once at boot from `AI_PROVIDER` and is invisible to every caller.

## Providers

| `AI_PROVIDER` | What runs | Cost | Needs |
|---|---|---|---|
| `local` (default) | Uzbek keyword lexicon + a sentence parser | none | nothing |
| `anthropic` | Claude, with `local` underneath as the fallback | per request | `ANTHROPIC_API_KEY` |

`local` is not a stub. It maps ~120 Uzbek product stems to categories and pulls
a volume and a price out of a sentence, which covers the common cases outright:

```
"12 tonna pomidor, kilosi 14 ming so'm"
  → sabzavotlar, quantity 12 t, price 14000 /kg
```

Two reasons it exists rather than calling the model for everything. The audience
is on connections that drop, and a suggestion that arrives only when the network
is up is a feature that does not work in a field. And category suggestion fires
as the seller types — paying for a model call on every debounced keystroke would
be the single largest line on the bill for the least valuable answer.

`anthropic` therefore does not replace it, it sits on top:

- **Category** — the keyword pass runs first. Above `0.75` confidence the model
  is never called. Below it, `claude-haiku-4-5` decides, and the keyword
  runners-up stay in the list behind its pick.
- **Draft** — `claude-opus-5`, one structured call.
- **Assist** — `claude-haiku-4-5`, short answers, last six turns of history.

Every model call is wrapped: a 4xx, a timeout or an unparseable answer logs a
warning and returns the local result. A missing key with `AI_PROVIDER=anthropic`
logs a warning at boot and uses `local` rather than refusing to start. An AI
outage must never be able to stop somebody posting a listing.

## Endpoints

All authenticated. All rate-limited per user per hour, in Redis.

| Route | Limit/hour | Returns |
|---|---|---|
| `POST /api/ai/category` | 120 | ranked candidates + `source` |
| `POST /api/ai/draft` | 30 | a full listing draft + `missingUz` |
| `POST /api/ai/assist` | 60 | one Uzbek answer |

The limits are generous for a person and tight for a runaway client, which is
the failure mode that actually costs money. Over the limit returns 429 with an
Uzbek message the UI shows verbatim.

`source` on every response says which pass answered (`keyword` | `model` |
`canned`). It is there for the logs: "the category suggestion was wrong" is not
diagnosable without knowing who suggested it.

## The draft is a draft

`POST /ai/draft` never writes anything. It returns the form's values and a
`missingUz` list of what the seller still has to supply; the form is prefilled
and fully editable, and publishing is a separate, ordinary request through
`POST /listings` with the same validation as a hand-typed listing.

That separation is deliberate. A listing carries a price and a phone number, and
a model that can publish one unattended is a model that can misprice somebody's
harvest in public.

Two guards close the gap between what the model returns and what the form
accepts:

- **Units** are overridden from the category's field spec, not taken from the
  model. It picks the category; the spec decides what units that category
  allows. See [CATEGORY-FORMS.md](CATEGORY-FORMS.md).
- **Attributes** go through `validateAttributes`, the same function
  `ListingsService` uses on write, so a key the model invented is dropped here
  rather than rejected at publish time.

## Structured outputs

Both JSON calls use `output_config.format` with a JSON schema, so shape errors
are the API's problem rather than a parser's.

The schema subset is narrower than JSON Schema. `minLength`, `maxLength`,
`minimum`, `maximum` and `maxItems` are all rejected with a 400, and an enum
cannot contain `null`. So: bounds are stated in the prompt and enforced on the
way out, and nullable enums are plain enums with the nullability handled in
code. Adding a bound to one of these schemas without checking that list is the
easiest way to send every draft silently down the fallback path — which is what
happened twice while this was being built, and the only visible symptom was
`source: "keyword"` where `"model"` was expected.

Category ids are never returned by the model. It returns a slug from an `enum`
of the slugs that exist, and the id is looked up locally — a hallucinated id
would be a foreign-key error at publish time.

## Voice

Dictation on the posting form uses the browser's own `SpeechRecognition` with
`lang="uz-UZ"`, not an upload. It costs nothing, works on the Chrome build that
ships on the phones in this market, and keeps the recording off our servers.
Where the API is absent the mic button does not render and typing still works.

`AI_TRANSCRIBE_MODEL` and the OpenAI-compatible settings beside it are still in
the config for the mobile app, which will need server-side transcription because
it has no browser to borrow one from.

## Prompting

The system prompt states who the audience is — farmers, 25-60, typing on a
phone, not technical — and demands Uzbek in Latin script. The single most
important line is the last one:

> Hech qachon narx yoki hajmni o'zingdan to'qima — foydalanuvchi aytmagan
> bo'lsa bo'sh qoldir.

A model that fills in a plausible price is worse than one that leaves the field
empty. `missingUz` exists so that "I don't know" has somewhere to go.

## Cost

At list prices, `claude-opus-5` is $5/$25 per MTok and `claude-haiku-4-5` is
$1/$5. A draft is roughly 1.5K in and 0.4K out; classification and assist are an
order of magnitude smaller and run on Haiku. The keyword pass answering the
confident cases is what keeps the classification bill near zero at scale — it is
the majority of requests, because most sellers type a product name that is in
the lexicon.

## Adding a provider

Implement `AiService`, add the branch in `ai.module.ts`. Nothing else changes:
the controller, the facade, the rate limiter and both clients are written
against the interface. This matters more than usual here — user data has to be
hosted inside Uzbekistan, so a locally hosted model is a likely future provider
rather than a hypothetical one.
