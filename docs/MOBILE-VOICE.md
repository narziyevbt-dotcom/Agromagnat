# Voice-first posting — mobile

Say the listing in one sentence; the form fills itself in.

```
"12 tonna pomidor, kilosi 14 ming so'm"
  → sabzavotlar · 12 t · 14 000 so'm/kg
```

## The assistant fills, it never posts

`POST /ai/draft` writes nothing. It returns the form's values plus a
`missingUz` list, the form is prefilled and fully editable, and publishing
stays a separate ordinary request through the same validation a hand-typed
listing gets.

A listing carries a price and a phone number. A model that can publish one
unattended is a model that can misprice somebody's harvest in public. The
composer says so on screen — *"Yordamchi faqat to'ldiradi — joylashni
o'zingiz tasdiqlaysiz"* — and a test asserts it.

Two guards close the gap between what comes back and what the form accepts,
mirroring what the backend does on its side:

- **Units come from the category's spec, not the draft.** The model picks the
  category; the spec decides what units that category allows. A suggestion of
  "kg" for machinery lands in a select that cannot show it, so it is dropped
  and the spec's default stands.
- **Attributes the category never declared are dropped**, not sent. Better
  here than rejected at publish time.

`missingUz` is where "I don't know" goes, which is what lets the assistant
leave a price empty rather than invent a plausible one. It is listed under the
composer, because a `missingUz` nobody reads is the same as no `missingUz`.

## Dictation is on the device

The backend has **no transcription endpoint** — `docs/AI.md` says as much, and
the OpenAI-compatible settings beside `AI_TRANSCRIBE_MODEL` are still unused.
So this mirrors the decision the web app made: it borrows the platform's own
recogniser rather than uploading audio.

That costs nothing, keeps the recording off our servers, and removes an upload
from a connection that drops. When a server-side endpoint lands, a second
implementation of `Dictation` is the whole change.

**The mic is absent, not disabled, where Uzbek is unavailable.** Android's
recogniser has had `uz-UZ` for a while; Apple's Speech framework does not list
Uzbek at all, so on iOS the button is expected not to appear. Typing into the
same box works everywhere and is what every other part of this feature is
written against — the composer never depends on the mic existing.

`isAvailable()` checks for an Uzbek locale specifically, not just that a
recogniser exists. One that only speaks Russian would turn an Uzbek sentence
into nonsense, which is worse than no mic.

## The lexicon runs on the phone

`uz_lexicon.dart` mirrors the backend's `uz-lexicon.ts`, which is what the
`local` AI provider runs and what the `anthropic` provider falls back to.

It is on the client for one reason: the audience is on connections that drop,
and a feature that only works when the network is up is a feature that does not
work in a field. Two consequences — the composer works with no backend at all,
and `source` on a draft is honest, because a keyword pass is what produced it.

What it handles, and why each matters:

| Input | Result | Why |
|---|---|---|
| `14 ming so'm` / `2 mln so'm` | 14 000 / 2 000 000 | Scale words are how prices are said |
| `so'mdan`, `so'mga`, `sum` | all match | The currency word takes any suffix |
| `so‘m`, `soʻm`, `so'm` | all match | A phone keyboard produces all three |
| `kilosi 14 ming so'm` | unit `kg` | The unit sits either side of the amount |
| `12 tonna … 14 ming so'm` | volume 12, **not 14** | Money is parsed first so its number is not also read as a volume |
| `kakao dukkagi` | no category | A wrong category costs more than none |
| no price in the sentence | price stays null | A plausible price is worse than an empty field |

## Permissions

- **Android** — `RECORD_AUDIO`, plus a `<queries>` entry for
  `android.speech.RecognitionService`. Without the latter, Android 11+ package
  visibility hides the recogniser and the mic silently does nothing.
- **iOS** — `NSMicrophoneUsageDescription` and
  `NSSpeechRecognitionUsageDescription`, in Uzbek. Declared even though Uzbek
  is not supported there: a missing string is a crash rather than a graceful
  absence if Apple ever adds it.

## Tests

40 tests. The lexicon gets its own file because each case in the table above is
a sentence a seller actually says, and getting one wrong fills the form with
nonsense — which is worse than leaving it empty.

`FakeDictation` and `FakePhotoPicker` stand in for platform channels that do
not exist under `flutter test`; `dictationProvider` and `photoPickerProvider`
are the seams.

## Not done yet

- **The model provider.** Everything here is the keyword pass. Wiring
  `POST /ai/draft` means a Dio-backed `AiRepository` and nothing else — the
  screen, the controller and the guards are all written against the interface.
- **Category suggestion as you type.** `POST /ai/category` exists and the web
  uses it; here the category is only suggested through a full draft.
- **Server-side transcription**, which is what would give iOS a mic.
