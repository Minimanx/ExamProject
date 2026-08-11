# Phase 3 — Core loop

**Spec:** `docs/superpowers/specs/2026-08-09-flixdrive-roadmap-design.md`, Phase 3.

**Exit criteria (from the spec):** two people can find each other by search, chat in
the open world, and watch a film with synchronized play/pause.

## Global constraints

- The video never touches the server. Nothing is uploaded, proxied or transcoded.
- No new recurring cost. Sync is socket messages; the media is local.
- Every change lands with tests, and CI stays green across all four jobs.
- Theaters are ephemeral — they expire and are swept — so schema changes need care for
  live documents but not a full migration.

---

## Decision: what "BYO copy with synced host controls" means

The spec says the film is watched **"BYO copy with synced host controls"** now, with
**"browser-extension sync (Teleparty model) much later"** in Phase 10.

Two readings were possible:

1. **Each viewer opens a local video file in the app**, and the host's play/pause/seek
   drives everyone's player directly.
2. **Each viewer watches elsewhere** — Netflix in another tab — and the app only shows a
   shared transport bar telling them when to press play.

**Reading 1 is what gets built.** Phase 10 exists precisely to handle streaming services,
which is what reading 2 is a poor substitute for; building a "press play now" prompt in
Phase 3 would be a worse version of Phase 10 that has to be deleted when Phase 10 lands.
A local file opened with `URL.createObjectURL` gives real, frame-accurate control, and it
never leaves the browser — the constraint above holds exactly.

Consequence: a `<video>` element enters the theater page. It plays a file the viewer picks
from their own disk. The server learns the film's *duration* and *position* only, never a
byte of it.

---

## Decision: how "at most N events per owner" stays atomic

Phase 2 made `theaters.ownerID` unique, which is what stopped two overlapping requests
both creating an event (C4). A configurable limit cannot be expressed that way — a unique
index says "at most one", not "at most N".

Each theater instead carries an **`ownerSlot`**, an integer in `0..limit-1`, with the
unique index moved to `{ ownerID, ownerSlot }`. Creating a theater allocates the lowest
free slot for that owner, exactly as `position` already allocates a slot on the strip, and
retries on a duplicate-key conflict. "At most N" is then enforced by the database rather
than by a count-then-insert that races.

---

## Task 1: Configurable limits

**Files:** `server/config.js`, `server/limits.js` (new), `server/schemas.js`,
`server/services/theaterService.js`, `server/routers/theaterRouter.js`,
`server/database/createConnection.js`

The three hardcoded numbers become one place:

| Limit | Today | Env override | Default |
| --- | --- | --- | --- |
| Scheduling window | `86400000` inline, twice | `MAX_SCHEDULING_WINDOW_HOURS` | 24 |
| Seats per theater | `99` in the schema message and rule | `MAX_SEATS` | 99 |
| Live events per owner | unique index on `ownerID` | `MAX_EVENTS_PER_OWNER` | 1 |

Defaults reproduce today's behaviour exactly, so nothing changes until someone sets a
variable. Phase 8 turns these into per-tier values rather than per-deployment ones.

The seat limit appears in a validation *message*, so the message has to be built from the
limit rather than written out — otherwise raising the limit leaves the error lying.

## Task 2: Theater search and filters

**Files:** `server/schemas.js`, `server/services/theaterService.js`,
`server/routers/theaterRouter.js`, `client/src/lib/components/TheatersListView.svelte`

`GET /theaters` takes optional query parameters:

- `q` — matches event name or movie name, case-insensitive, anchored on word starts
- `hasSpace` — only theaters with a free seat
- `startingWithin` — minutes; only theaters starting inside that window

Filtering happens in the query, not in the client, because the client already has the full
list only by accident of the strip being small. Occupancy reconciliation still runs on
whatever comes back.

The list view gets a search box bound to `q` with a short debounce.

## Task 3: Lobby keys

**Files:** `server/services/theaterService.js`, `server/schemas.js`,
`server/routers/theaterRouter.js`, `client/src/lib/components/TheaterInfoScreen.svelte`,
`client/src/lib/components/CreateEventScreen.svelte`

A private theater carries a `lobbyKey` — 16 hex characters, generated server-side —
instead of a bcrypt-hashed password the host had to invent and then tell people out of
band. Joining supplies the key; the host copies a link that carries it.

Replaces `passwordBool` + `password`. Documents from before this change still have the old
fields and will expire naturally, so the join path accepts either until they are gone,
with the old path clearly marked for deletion.

## Task 4: Speech-bubble proximity chat

**Files:** `server/socketios/carSocket.js`, `server/schemas.js`,
`client/src/lib/pages/InteractiveSpace.svelte`, `client/src/lib/art/` (bubble component)

A message typed in the hub appears as a bubble above the sender's car for a few seconds,
delivered only to players within range. Range is computed server-side from the last known
car position, so a modified client cannot listen to the whole world.

Reuses the length and rate limits already in `chatSocket.js` — same limits, same reasons —
rather than inventing a second set.

## Task 5: Synced playback

**Files:** `server/socketios/playbackSocket.js` (new), `server/services/theaterService.js`,
`client/src/lib/pages/InsideTheater.svelte`, `client/src/lib/components/VideoStage.svelte` (new)

The host owns playback. State is `{ playing, positionSeconds, updatedAt }`, broadcast on
change and on join, so someone arriving late lands at the right position.

- **Ready-check:** the host asks; each occupant answers; the host sees the tally.
- **Countdown:** the host starts a 3-2-1 that every client renders, then playback begins
  together.
- **Drift correction:** a client more than a second out seeks; a client slightly out nudges
  `playbackRate` instead, because a seek is visible and a nudge is not.

Only the host may change playback state — enforced on the server, since the client
controls are merely hidden from everyone else.

---

## Order and rationale

1, then 2, then 3, then 4, then 5. Limits first because they are small and touch code the
later tasks build on. Playback last because it is the largest and the least like anything
already here.
