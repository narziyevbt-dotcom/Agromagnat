# Offline — mobile

A farmer standing in a field with no signal opens the app and sees the last
listings it fetched, labelled with how old they are.

## What is cached, and what is not

| | Cached | Why |
|---|---|---|
| Home feed, first page | yes | The screen the app is opened to |
| Any listing opened | yes | Where a buyer stands when they decide to call |
| Categories, regions, districts | yes | Without them the posting form cannot open at all |
| Filtered searches | **no** | Unbounded key space, and a buyer who filtered to "Samarqand, under 10 000" wants an answer to that question, not a remembered one |
| Anything authenticated | **no** | |

Storage is `shared_preferences` holding raw JSON. Not a database: what is kept
is one page and the catalogue, both read whole and replaced whole. A database
buys queries nothing asks for, and its migration story is a real cost — a
schema change that fails on a farmer's phone leaves the app unable to open.

**The raw response is stored, not the entities.** There is already a mapper
from JSON to domain objects; serialising back would mean a second mapper
written in reverse, and the day the two disagree a listing reads back wrong
from disk with nothing to catch it. One mapper, one direction.

## Painted before the request is sent

`HomeFeedNotifier` reads the cache on construction and emits it, then fetches.

A plain `FutureProvider` spends the whole connect timeout on a spinner before
it can show anything — fifteen seconds of nothing for a farmer with no signal,
ending in an empty screen. Waiting that out and *then* showing what was on disk
all along is the worst of both.

If the fetch fails and something is already on screen, it stays. Replacing a
cached feed with an error page throws away the only useful thing the app has.

## Only a dead network falls back

`ApiException.status == 0` — a timeout or an unreachable host. A 500 or a 400
means the server answered, and showing yesterday's feed as though nothing
happened hides a real fault.

A 404 on a listing goes further: the cached copy is **deleted**. Serving a
listing that no longer exists would send a buyer to call about it.

## The age is shown, not just the fact

`OfflineBanner` sits above the categories, because it changes how every price
below it should be read.

Showing stale listings silently is worse than showing none — a farmer who reads
a three-day-old price as today's will quote it to a buyer. "Offline" alone
leaves them to guess how old, and they will guess generously, so the banner
says *"Oxirgi ma'lumot: 3 kun oldin"*.

A cached page also carries **no cursor**. Paging on from disk would ask the
server to continue something it never sent.

## Cleared on sign-out

A cached listing carries `isFavorite`, which belongs to whoever was signed in.
Shared handsets are common here, and the next user should not see somebody
else's saved hearts. `JsonCache.clear()` removes only its own keys.

A decode failure is also treated as a miss and drops the entry. The cache is
disposable, and an app that cannot start because a release renamed a field is a
far worse outcome than a cold cache.

## Tests

21 tests. `offline_cache_test.dart` drives the repositories through an adapter
that can be switched offline mid-test, over the same live-API fixtures the
mapper tests use.

The interesting ones are the negatives: a filtered search is not served the
unfiltered feed, a 500 is not papered over, a deleted listing does not linger,
and a repository built without a cache still works — it simply does not cache.

## Not done yet

- **Queued posting.** A listing written with no signal is lost on submit. The
  draft survives in memory only, and `shared_preferences` is already a
  dependency for exactly this.
- **Photo upload retry.** Same shape: the listing publishes, the photos do not,
  and there is no queue to finish them later.
- **Cache eviction.** Listing details accumulate one key each and nothing ever
  removes them. Bounded in practice by how many listings one person opens, but
  it is unbounded in principle.
