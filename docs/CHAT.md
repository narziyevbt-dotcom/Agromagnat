# Chat

One conversation per (listing, buyer). The listing is what the conversation is
about, so a buyer asking about two of a seller's lots gets two threads, and a
seller sees which produce each question refers to before reading a word of it.

## API

| Method | Path | What it does |
|---|---|---|
| `POST` | `/api/listings/:id/chat` | Open the thread, or return the existing one |
| `GET` | `/api/chats` | Inbox — every conversation, either side, most recent first |
| `GET` | `/api/chats/unread-count` | Total unread, for the nav badge |
| `GET` | `/api/chats/:id` | One conversation as the caller sees it |
| `GET` | `/api/chats/:id/messages` | History, newest first, cursor-paginated |
| `POST` | `/api/chats/:id/messages` | Send |
| `POST` | `/api/chats/:id/photo` | Send a photo (multipart, one file) |
| `POST` | `/api/chats/:id/read` | Clear the caller's badge, receipt the other side |

All of it requires a token. Everything is scoped to the two participants.

## Web

`/xabarlar` is the inbox, `/xabarlar/:id` the thread. Both live on the public
site rather than inside the dashboard shell: chat is the same screen for a
buyer and a seller, and building it twice would mean maintaining it twice. The
dashboard sidebar links straight there.

Messages is now slot four of the bottom nav, which is what the brand book
always specified; Favorites held the slot while chat did not exist and has
moved one tap deeper, onto the profile screen.

## Decisions worth knowing

**Photos are their own endpoint, not a flag on send.** The payload is
multipart, the failure modes are different — a 12 MB file on EDGE, a file
sharp cannot decode — and folding both into one handler would leave a text
send carrying an upload path it never uses.

The message's `body` holds the stored photo's URL; there is no second column
for it, and adding one would be a migration for a value the row already has
room for. `chats.last_message_text` is set to *"📷 Rasm"* instead of that URL,
because the inbox preview is read by a person. The photo goes through the same
pipeline as a listing photo — resized to 1280px, WebP, EXIF-rotated — since the
recipient is on the same connection either way.

It counts against the same per-user rate limit as text. Otherwise the limit is
a formality: the photo endpoint would be the way around it, and photos are the
expensive messages.

**No `clientId` on a photo.** An upload that timed out was not stored, and a
retry would re-send the bytes — on this connection the bytes are the expensive
part, not the row.

**Non-participants get 404, not 403.** A 403 confirms the id exists. There is
nothing to gain from telling a stranger that a particular conversation is real.

**Sending is idempotent on a client-generated `clientId`.** On the connections
this audience has, the request often succeeds while the response is lost. Without
an idempotency key, the user's second tap posts the message twice; with one, the
retry returns the message already stored. The unique index on `client_id` is the
enforcement — the replay handler only treats a collision as a replay when the
stored row belongs to the same sender *and* the same chat, so a genuine id
collision still raises rather than handing back someone else's message.

**The insert, the preview and the unread counter are one transaction.** A
message visible in the thread but missing from the counter is an inbox that
never shows a badge, which is indistinguishable from a message never delivered.

**The inbox orders by `COALESCE(last_message_at, created_at)`.** A thread just
opened but not yet written in belongs at the top, where the user put it.

**Sending is rate-limited to 30 messages a minute per account**, across all
conversations. Chat is the cheapest spam channel on the platform; without a cap,
a bot blasts every seller in a region in seconds. Blocked accounts cannot send
at all.

**The web polls every 6 seconds instead of holding a socket.** The audience is
on intermittent mobile data where a dropped connection is the normal case, and a
poll that always recovers beats a socket that silently stops delivering. Two
things keep the cost down: polling pauses when the tab is in the background, and
the Next.js route handler filters the page to messages newer than the last one
seen, so the slow hop to the phone carries a few hundred bytes rather than the
whole tail of the conversation.

**Messages page backwards with a keyset cursor.** New messages arrive while the
user scrolls; an OFFSET page would repeat or skip rows every time one lands.

**The phone number stays one tap away inside the thread.** Chat supplements the
call button, it does not replace it — a deal in this market still closes on the
phone, and a farmer mid-negotiation will reach for it.

## Deferred

- Image messages. `messages.type` already has the `image` case and storage is
  wired for listing photos; the upload endpoint and the composer are not built.
- System messages ("listing marked sold"), same reason — the enum case exists.
- Typing indicators and presence. Both need a live connection to be worth
  anything, and neither survives a 3G handover well enough to be trusted.
- Server-Sent Events as a polling replacement, once the mobile app is the
  primary client and the backend runs behind a proxy configured for streaming.
