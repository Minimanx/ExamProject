# FlixDrive Roadmap

**Date:** 2026-08-09
**Status:** Approved (roadmap level). Individual phases still need their own specs.

---

## 1. What FlixDrive is today

A pixel-art drive-in cinema. You drive a car along a shared 1D side-scrolling strip,
park at a screen, and enter a lobby with text chat synced to a movie start time. OMDB
supplies title, runtime, poster and plot; the film itself is never touched — everyone
presses play on their own copy.

It began as a school exam project and is being revived as a product.

### Verified stack

| Layer | Current | Notes |
|---|---|---|
| Client | Svelte 3, Rollup 2, svelte-navigator 3.2.2 | ~2,600 lines |
| Server | Express 4, raw `mongodb` driver 6, Socket.IO 4 | ESM, ~700 lines |
| Sessions | `express-session` + `connect-mongo` | Cookie, 7-day, Mongo-backed |
| Data | Two collections: `theaters`, `users` | No schema layer, no indexes |
| Deploy | Vercel (client) + Heroku-style dyno (server) | `DEPLOYMENT.md` |
| Tests | **None.** `npm test` exits 1 | No lint, no CI, no types |

### Constraints baked into the current design

These are load-bearing today and several roadmap items push directly against them:

- One live event per user (`theaterRouter.js:93`).
- Events must start within 24 hours (`theaterRouter.js:83`).
- Theaters occupy integer slot positions on a single global strip.
- Every client fetches and renders every theater.
- `usersInsideTheater` is written by the HTTP layer and removed by the socket layer.
- Rendering happens on a fixed 1500×800 stage, CSS-scaled to the viewport.

---

## 2. Product decisions

Settled during the brainstorm; these drive the sequencing.

| Question | Decision |
|---|---|
| What is it becoming? | **A real product** — public launch, strangers, revenue. |
| How is the film watched? | **BYO copy with synced host controls** now. Browser-extension sync (Teleparty model) much later. |
| Capacity | **Solo, evenings and weekends**, with heavy agent assistance. |
| Monetization | **Cosmetics + film clubs + hosting privileges/capacity.** Media quality is explicitly *not* monetized. |
| World model | **Hub + instanced spaces.** Hub sharding later, only if the userbase demands it. |
| Sequencing | **Features first, safety retrofitted** behind a named gate. |
| Router | **Migrate to SvelteKit.** |

### Two consequences worth stating explicitly

**Media is a pure cost centre.** Because voice and camera are not monetized, they must not
run on an SFU. Peer-to-peer mesh, hard-capped at roughly 5 participants, costs nothing in
bandwidth. A TURN relay is unavoidable (10–20% of connections need one) and is the only
recurring media cost.

**Review capacity is the bottleneck, not authorship.** Agents write most of the code;
~5–10 h/week of human review is the scarce resource. CI is therefore not hygiene, it is
review capacity. This is why a test harness appears inside Phase 0 rather than after it.

---

## 3. Sequencing rationale

Three shapes were considered:

- **Gate everything on public launch** — build the full trust-&-safety stack before any
  stranger arrives. Safest legally; ~2 months of invisible work with no feedback loop.
- **Invite-only beta first** — ship closed, defer most T&S until opening up.
- **Features first, safety retrofitted** — *chosen.* Build the product, then harden it
  before opening registration.

The chosen shape carries a real risk: retrofitting moderation into a live social product
is how products get overrun. Two cheap hedges reduce it to an acceptable level, and both
are included below rather than left implicit:

1. **Registration stays invite-only behind a flag until Phase 9.** "Features first" does
   not have to mean "strangers first," and it costs one boolean.
2. **Safety data models land early (Phase 2), unused.** Empty `reports` and `blocks`
   collections and a `moderationState` field on users. Retrofitting UI is easy;
   retrofitting a data model across a live database with real user history is not.

---

## 4. The phases

| # | Phase | Size |
|---|---|---|
| 0 | Upgrades & framework migration | 3–4 wk |
| 1 | Test coverage | 2 wk |
| 2 | Bug fixes, code smells, production readiness | 3–4 wk |
| 3 | Core loop | 4–6 wk |
| 4 | Hub + instanced spaces | 6–10 wk |
| 5 | Friends & film clubs | 6–10 wk |
| 6 | Voice & camera | 6–10 wk |
| 7 | Procedural terrain | 4–8 wk |
| 8 | Monetization | 4–6 wk |
| 9 | **GATE:** trust & safety | 8–12 wk |
| 10 | Browser extension sync | 8–12 wk |
| 11 | Hub sharding | if needed |

Sizes are calendar estimates at evenings-and-weekends pace with agent assistance, not
person-weeks.

---

### Phase 0 — Upgrades & framework migration (3–4 weeks)

**Goal:** get onto current, maintained versions before writing any new feature code, so
that new code is written once in the modern idiom rather than migrated later.

**Version reality** (checked 2026-08-09):

| Package | Current | Latest | Action |
|---|---|---|---|
| svelte | 3.x | 5.56.8 | Migrate to runes |
| rollup | 2.x | — | Replaced by SvelteKit's Vite |
| svelte-navigator | 3.2.2 | 3.2.2 | **Dead.** Peer-deps `svelte: 3.x`, last published Aug 2022. Must be replaced |
| @zerodevx/svelte-toast | 0.7.2 | 0.9.6 | Bump; already Svelte 5 compatible |
| svelte-loading-spinners | 0.1.7 | 0.3.6 | Bump or replace with CSS |
| express | 4.x | 5.2.1 | Upgrade |
| express-rate-limit | 6.x | 8.6.2 | Upgrade |
| mongodb | 6.x | 7.5.0 | Upgrade |
| node-fetch | 3.x | — | **Delete.** Node 22 has global `fetch` |
| socket.io, bcrypt, connect-mongo, nodemailer | — | — | Already current, no action |

**Six independently shippable steps.** Combining these into one PR produces something
nobody can review at 5–10 h/week.

| Step | Work |
|---|---|
| 0.1 | Supertest characterization tests over the 12 existing endpoints. Framework-agnostic — survives every change below |
| 0.2 | Express 5, rate-limit 8, mongodb 7, delete `node-fetch`. Verified by 0.1 |
| 0.3 | ✅ Extracted inline SVG art into components; 1,086 → 570 lines |
| 0.4 | ✅ Replaced svelte-navigator with a ~40-line in-repo router; bumped toast and spinners |
| 0.5 | ✅ Svelte 3 → 5 runes on Rollup. Also added the client's first automated tests — 21 Playwright e2e specs — because the migration breaks reactivity silently |
| 0.6 | ✅ Rollup → SvelteKit, bringing Vite 8. Uses `adapter-static` rather than `adapter-vercel` — see below |

Step 0.3 sits before the runes migration deliberately: `InteractiveSpace.svelte` is 1,086
lines, of which the inline SVG is 62% by bytes but only 44% by lines. Extracting it first
took the file to 570 lines (measured, not estimated — the CSS moved too), so 0.5 migrates small files instead of one enormous one. Step 0.4's in-repo
router is ~40 lines of deliberate waste that buys the ability to land the runes migration
and the SvelteKit adoption as two separately reviewable changes.

**`adapter-vercel` after all.** The roadmap named `adapter-vercel` so that
SvelteKit's SSR could serve future marketing and club pages. That reasoning still holds,
but no route can server-render today: both pages call `createSocket()` at component-init
scope and `userStore` reads `localStorage` at module scope, so `ssr = false` is set
app-wide. `adapter-vercel` would deploy serverless functions rendering nothing on the
server — strictly worse than the static hosting already in place. `adapter-static` shipped first on that
reasoning, then was swapped back: Vercel's own SvelteKit preset expects
`adapter-vercel`'s output shape, so `adapter-static` required extra dashboard
configuration to deploy. Removing that friction was worth more than avoiding a
serverless function that renders nothing. The runtime is pinned to `nodejs24.x`
rather than inferred from the building Node version, which otherwise breaks on any
version Vercel does not offer.

**The standalone Rollup → Vite step was dropped** once the compatibility matrix was
checked: `@sveltejs/vite-plugin-svelte@7` requires Svelte 5, and the newest plugin
supporting Svelte 3 pins Vite 4 — so "Vite while still on Svelte 3" means standing up a
build tool that 0.6 immediately replaces. `rollup-plugin-svelte` declares
`svelte: >=3.5.0`, so Rollup carries Svelte 5 through 0.5 instead, and SvelteKit brings
Vite 8 with it in 0.6.

**Known breakages to expect:**

- `app.js:115` uses `app.get("*")`. Bare `"*"` is invalid in Express 5's path matcher and
  throws at boot. Only active when `SERVE_CLIENT=true`.
- `userStore.js:4` calls `localStorage.getItem` at **module scope**, which throws under
  SSR. Needs a `browser` guard in 0.6.
- The world route touches `window` directly; it needs `export const ssr = false`. Later
  marketing, club and legal pages keep SSR on — that is the point of adopting SvelteKit.
- `client/public/` becomes `static/`. `process.env.API_URL` (currently injected by
  `@rollup/plugin-replace`) becomes `$env/static/public` with a `PUBLIC_` prefix.
- `vercel.json`'s rewrite rule is replaced by `adapter-vercel`.

**Exit criteria:** app runs on SvelteKit + Svelte 5 + Express 5; the 12 endpoint tests
pass; no dependency in either `package.json` is a major version behind.

---

### Phase 1 — Test coverage (2 weeks)

**Goal:** make agent-written code checkable by CI rather than by eye.

- Component tests written **against Svelte 5**, so nothing is written twice.
- Playwright smoke path: signup → login → create event → drive → join lobby → chat.
- ESLint + Prettier + `eslint-plugin-svelte`.
- GitHub Actions: lint, test, build on every PR. Branch protection on `main`.

**Exit criteria:** a red CI run blocks merge; the smoke path runs on every PR.

---

### Phase 2 — Bug fixes, code smells, production readiness (3–4 weeks)

**Goal:** turn an exam project into something that can be operated.

**Defects** — see the inventory in §5. All of them land here.

**Production readiness:**

All of these shipped during Phase 0 and Phase 2; the detail is in the §5 entry named
after each.

- ~~Structured logging (`pino`) replacing `console.log`/`console.error`.~~ **DONE** — O3.
- ~~Express error-handling middleware.~~ **DONE** — O2. Express 5 forwards a rejected
  promise from a handler to the error middleware, so no `try`/`catch` was needed in
  `GET /theaters` itself.
- ~~Graceful shutdown: SIGTERM → drain Socket.IO, close Mongo.~~ **DONE** — O4.
- ~~Boot-time config validation.~~ **DONE** — `config.js` reports every problem at once
  rather than the first.
- ~~`helmet` for security headers.~~ **DONE** — S6.
- ~~**CSRF protection.**~~ **DONE** — S5. `sameSite` cannot be tightened, since client and
  API are on different origins, so a state-changing request from a declared-but-unknown
  origin is rejected instead.
- ~~**Socket authentication.**~~ **DONE** — S4, and S3 alongside it: handlers trusted a
  client-supplied id rather than `socket.id`.
- ~~Expired-theater cleanup.~~ **DONE** — C6.
- ~~Mongo indexes on `users.email`, `users.username`, `theaters.position`.~~ **DONE** — O1,
  extended in C4 where `ownerID` and `position` became unique so two overlapping requests
  cannot both win.
- ~~Consistent error envelopes; use 401/403 for auth failures instead of the current 400.~~ **DONE 2026-08-10.** Every error now carries `{ message, code }`, with `code` stable and the status derived from it in `errors.js`. Authentication failures are 401, permission failures 403, and a theater that does not exist is 404 on every verb — it was 404 on `GET` and 400 on `PATCH`/`DELETE`. `CONFLICT` deliberately stays 400 rather than moving to 409: that is beyond what this phase asked for, and the distinct code means the status can move later without touching call sites. The client was checking `response.status === 400` and ignoring every other failure, so a 502 from OMDB already showed the user nothing; it now branches on `response.ok`.

**Code smells:**

- ~~Replace the ad-hoc `if`-chain validation with schema validation at the edges (`zod`).~~
  **DONE 2026-08-10.** Every route body and the movie query now parse through a schema in
  `schemas.js` before the handler runs, and `req.body` is replaced by the parsed value — so a
  handler cannot read a key the schema did not declare, which is the other half of C3. Messages
  are written out rather than left to zod, because the UI shows them verbatim; a test asserts no
  zod default ("Invalid input: expected object, received array") can reach a response, which is
  the class rather than the instances. The conversion found two things: `"Must choose a time"`
  was unreachable, because the combined presence check answered first, and joining a
  password-protected theater with no `password` field at all reached `bcrypt.compare`, which
  throws on a non-string — a malformed request was a 500.
- ~~Introduce a domain layer (theater service, user service) between routers and Mongo, and
  make it the single owner of `usersInsideTheater`.~~ **DONE 2026-08-10.** `services/theaterService.js`
  is the only file that touches `db.theaters` or names `usersInsideTheater`, and a test asserts
  exactly that — ownership was the part that was actually broken, since the field was written by
  the HTTP join and cleared by the socket's disconnect handler with nothing responsible for the
  pair. That split is what C5 cost. The socket layer now calls `removeOccupant` instead of
  issuing its own `$pull`. Slot allocation, the expiry sweep and the OMDB fetch moved out of the
  route bodies too, and `loadTheater` replaced three copies of validate-id-then-load-then-404 —
  which is why a PATCH to a well-formed but unknown id was a 400 while the same condition was a
  404 on GET. No user service: `userRouter` is one route and `loginRouter`'s queries are all
  session and reset-token work, so extracting one would be structure without a reader.
- ~~Rewrite date handling: store UTC, render in the viewer's locale, delete the hardcoded
  `3600000` offsets.~~ **DONE 2026-08-10.** Storage was already right — Mongo holds `Date`
  objects, which are UTC. The offsets went with C2. Rendering was the remaining half: three
  components each spelled out `getHours()`, `getMinutes()` and their own zero padding inline,
  always producing 24-hour, so a viewer who expects 8:30 PM saw 20:30. `formatTimeOfDay` now
  renders through `toLocaleTimeString`, with `locale` and `timeZone` as parameters so it can be
  tested from more than one place on Earth — a fixed instant reads `20:30` in `en-GB`, `8:30 PM`
  in `en-US`, and `02:00` the next day in `Asia/Kolkata`, which is the point of storing UTC.

**The two hedges from §3 land here:**

- ~~**Invite-only registration behind a flag.**~~ **DONE 2026-08-10.** `INVITE_ONLY=true`
  requires a valid unused code, read per request so it can be flipped without a redeploy. A code
  is redeemed through a link (`/?invite=CODE`) rather than a field on the form, so nothing extra
  appears while registration is open. It is claimed with a `findOneAndUpdate` filtered on
  `usedAt: null` — a read-then-write loses the race between two people holding one code — and
  claimed only once the signup is otherwise certain, so a taken username does not burn someone's
  only invite. If the insert still loses a race on the unique username or email index, the claim
  is released rather than consumed by an account that does not exist.
- ~~**Safety data models, unused.**~~ **DONE 2026-08-10.** `reports` and `blocks` collections
  with the indexes their eventual queries need — a queue drained oldest-first, everything ever
  reported about one person, and the reverse block lookup a room filter needs. A block is unique
  per pair, so a double-submit cannot create two. `moderationState` is written on every new
  account and backfilled once at boot for accounts that predate it, so Phase 9 never has to treat
  an absent field and `"active"` as the same thing. Nothing reads any of it yet; the tests exist
  so the shape cannot drift or be quietly dropped.

**Exit criteria:** §5 inventory closed; a `SIGTERM` drains cleanly; no unhandled promise
rejection reachable from any route.

---

### Phase 3 — Core loop (4–6 weeks)

**Goal:** make the thing people actually came for good.

- ~~**Speech-bubble proximity chat** in the hub.~~ **DONE 2026-08-11.** Range is decided by the
  server from positions it already receives, because filtering in the client is a rendering
  convention rather than a limit. Same length and rate rules as theater chat (S7).
- ~~**Synced playback controls.**~~ **DONE 2026-08-11.** Host play/pause/seek, ready-check and a
  shared countdown. Each viewer opens their own file with `createObjectURL`; only
  `{ playing, positionSeconds, updatedAt }` travels, so the server never learns anything about
  the film beyond a number of seconds. Host-only is enforced on the server — hiding the controls
  stops an honest client and nothing else. Drift is corrected by seeking when properly lost and
  by a small `playbackRate` change otherwise, because a seek is visible and a nudge is not.
- ~~**Theater search and filters.**~~ **DONE 2026-08-11.** `q`, `hasSpace`, `startingWithin`,
  filtered in the query. The search term is escaped to a literal: unescaped, `.*` would silently
  match everything.
- ~~**Lobby keys.**~~ **DONE 2026-08-11.** A server-generated key returned once to the host as a
  shareable link, replacing a password they had to invent and pass on out of band. The
  bcrypt path stays until pre-existing theaters expire.
- ~~**Lift the hardcoded limits.**~~ **DONE 2026-08-11.** `MAX_SCHEDULING_WINDOW_HOURS`,
  `MAX_SEATS`, `MAX_EVENTS_PER_OWNER`, defaulting to today's values. The per-owner limit needed
  an `ownerSlot`, since a unique index says "at most one" and not "at most N".

**Exit criteria:** ~~two people can find each other by search, chat in the open world, and
watch a film with synchronized play/pause.~~ **MET 2026-08-11**, each covered by a two-context
browser test.

---

### Phase 4 — Hub + instanced spaces (6–10 weeks)

**Goal:** the architectural change that unblocks clubs, multiple lobbies and procgen.

- ~~Hub becomes a first-class entity carrying an `instanceId`, with a capacity cap.~~
  **DONE 2026-08-11.** Every socket joins an instance room and world events address it rather
  than every connection. `HUB_CAPACITY` bounds one instance, and a caller has to handle a
  refusal now — while the answer is always "the world is full" — so Phase 11 can change the
  answer to "here is another" without changing a caller.
- ~~Instanced spaces for events and clubs.~~ **DONE 2026-08-11.** Each theater is its own room
  for chat and its own playback state; walking into one leaves the hub instance.
- ~~**Server-authoritative movement.**~~ **DONE 2026-08-11.** The server holds the position and
  accepts a proposal only if it is inside the world and reachable at the world's speed. Built as
  validation rather than server-side simulation — see the Phase 4 plan for the reasoning and for
  what would justify revisiting it.
- ~~**Spatial interest management.**~~ **DONE 2026-08-11.** A uniform grid answers "who is near
  whom" without walking the world, and crossing the boundary emits enter and leave — without
  those, interest management presents as cars freezing where they were last seen.
- ~~Multiple concurrent lobbies.~~ **DONE 2026-08-11.** Verified rather than assumed: six tests
  covering playback, chat, ready checks and countdowns across two simultaneous showings, plus
  that hosting one lobby confers no control over another.

**Exit criteria:** ~~two lobbies run simultaneously in separate instances; a client only
receives position updates for players it can see.~~ **MET 2026-08-11.**

---

### Phase 5 — Friends & film clubs (6–10 weeks)

**Goal:** the retention and monetization centrepiece. People stay for groups.

- ~~Friends: request/accept, presence, join-a-friend.~~ **DONE 2026-08-11.** One row per pair
  with the ids in a canonical order, so the unique index can see that A-asking-B and
  B-asking-A are the same relationship. Presence comes from the socket layer, the only thing
  that knows. Join-a-friend is performed by the server, because Phase 4 made a client-side
  teleport exactly what it refuses.
- ~~Clubs: member roster, roles and permissions, recurring schedule.~~ **DONE 2026-08-11.**
  Ordered roles, an owner who cannot be the last one to leave, and a moderator who
  deliberately cannot change roles. The schedule is a wall clock and an IANA zone rather than
  an instant, so a club meeting at 20:00 still meets at 20:00 after the clocks change.
- ~~Club discovery — public club pages, which is where SvelteKit's SSR starts paying rent.~~
  **DONE 2026-08-11.** SSR is now per route: the app moved into a `(app)` group that keeps
  `ssr = false`, because the world still opens a socket at component-init scope and measures
  the viewport before it can draw, and the club page sits outside it. A test fetches the page
  as bytes with no JavaScript and asserts the club is already in the HTML — verified by
  turning SSR off and watching it receive an empty shell.

**Exit criteria:** ~~a club can hold a recurring film night with a stable membership and a
public page.~~ **MET 2026-08-11.**

**Interface, added 2026-08-15.** The club work above shipped as seven endpoints with
nothing calling them: no way to create a club, browse, join or leave, and a public page
reachable only by someone who already had the slug — the opposite of discovery. There is
now an in-app panel and a public `/clubs` directory, both tested end to end.

**Not built:** club-owned spaces and club history. Both depend on a club owning theaters,
which is Phase 8's entitlement work — a club's right to hold a space is exactly the kind of
thing the spec says must be server-enforced from an entitlements service rather than
invented here and rewired later.

---

### Phase 6 — Voice & camera (6–10 weeks)

**Goal:** presence, without an infrastructure bill.

- **P2P mesh WebRTC, hard-capped at ~5 participants. No SFU.** Mesh bandwidth grows
  quadratically, which is exactly why the cap is a hard product constraint, not a setting.
- TURN relay — the one unavoidable recurring cost.
- Push-to-talk, mute, per-user volume. Camera off by default.
- **Camera gated to clubs and friends only.** Open camera to strangers is the single
  highest-risk surface in this product, and Phase 9 has not happened yet at this point.

**Exit criteria:** five people hold a voice conversation in a lobby with no server-side
media relay beyond TURN.

---

### Phase 7 — Procedural terrain (4–8 weeks)

**Goal:** variety, without discarding the hand-drawn identity.

- Seeded and deterministic, with the server assigning the seed so all clients agree.
- Generates **club and instance spaces** in the established pixel aesthetic. The hub stays
  hand-authored — it is the product's face.

**Exit criteria:** two clients given the same seed render an identical space.

---

### Phase 8 — Monetization (4–6 weeks)

**Goal:** revenue, server-enforced.

- Stripe: subscriptions plus one-off cosmetic purchases.
- **Entitlements service** — a single server-side authority on what a user may do. Client
  checks are presentation only.
- Cosmetics: car skins and plates, extending the existing colour system.
- Free/paid limits wired to entitlements — the caps lifted in Phase 3 become the ladder.
- Billing edges: dunning, refunds, downgrade behaviour.

**Open policy question:** what happens to a film club when its owner stops paying? This
needs an answer before launch, not after.

**Exit criteria:** a paid entitlement can be purchased, revoked on non-payment, and is
never enforced client-side alone.

---

### Phase 9 — GATE: trust & safety (8–12 weeks)

**This phase is the gate on opening registration to the public.** Until it ships,
registration stays invite-only behind the Phase 2 flag.

- Email verification and an age gate.
- Reporting flow with evidence snapshots — report a user, a lobby, or a message.
- Moderation queue and admin surface.
- Blocking and muting, enforced server-side.
- Text classification, flood control, per-user rate limits on chat.
- Ban and suspension model, with session invalidation.
- Audit log.
- Legal minimum: Terms of Service, privacy policy, GDPR export and delete, DSA
  notice-and-action for EU users.
- Camera policy review before any loosening of the Phase 6 gating.

**Exit criteria:** a reported user can be actioned end-to-end by a moderator, and a
GDPR delete request can be satisfied.

---

### Phase 10 — Browser extension sync (8–12 weeks)

A separate codebase with its own release cadence. Chrome and Firefox extensions,
per-platform adapters for the streaming services, store review cycles.

Deliberately last among build items: it is a permanent maintenance treadmill against
platforms that will break it, and it is only worth taking on once there is a social layer
people already show up for.

---

### Phase 11 — Hub sharding (only if needed)

Triggered by concurrency, not by calendar. The `instanceId` groundwork from Phase 4 makes
this configuration rather than rearchitecture.

---

## 5. Verified defect inventory

Every item below was read in the source, not inferred.

### Security

| # | Location | Issue |
|---|---|---|
| ~~S1~~ | `loginRouter.js:109` | **FIXED 2026-08-10.** `$unset: { passwordtoken: "" }` — lowercase `t`, but the field is written as `passwordToken` at line 61, so reset tokens were never invalidated after use. Combined with S9 this was an unauthenticated, token-free takeover: an attacker knowing only a victim's email, and that the victim had ever requested a reset, could pass `{ $ne: null }` as `token` and clear both `/resetpassword` checks. Casing corrected; regression test at `passwordReset.test.js` ("invalidates the reset token after it has been used"). |
| ~~S2~~ | `loginRouter.js:60` | **FIXED 2026-08-10.** The reset token was `crypto.randomBytes(3)` — 6 hex characters, 16.7M values — with no expiry and no attempt cap. S1 had already made a token single-use, which bounds the reward for one correct guess but not the size of the search: a distributed attacker with ten thousand IPs exhausts 16.7M in a few days, and nothing expired in the meantime. Three controls now bound it, each covering what the others cannot — 16 hex characters of entropy (8 bytes) makes the search hopeless; a 15-minute TTL bounds how long a leaked token is worth anything; and a per-account cap of 5 attempts burns a token that is being guessed at, so it dies rather than waiting to be found. The counter is keyed on email, so guessing at one account cannot burn another's token, and issuing a new token clears it. All three fields are cleared together on use. Note for deployment: every token outstanding at deploy time stops working, because a document with no `passwordTokenExpiresAt` cannot match `{ $gt: now }` — which is the desired outcome, since those are the weak ones. |

| ~~S3~~ | `carSocket.js` | **FIXED 2026-08-10.**  `carPosition` and `carJoined` trust a client-supplied `id` instead of `socket.id`. Position and identity were spoofable. Handlers now use `socket.id` and ignore any client-supplied id; the client no longer sends one. Regression tests in `test/sockets.test.js`. |
| ~~S4~~ | `carSocket.js` | **FIXED 2026-08-10.**  No `session.loggedIn` check, so unauthenticated sockets could join the world and broadcast to every player. Every car handler now requires a logged-in session. Consequence worth noting: anonymous visitors no longer appear as cars, which is correct since the login overlay blocks the world for them anyway. |
| ~~S5~~ | `app.js` | **FIXED 2026-08-10.**  `sameSite: "none"` + `credentials: "include"` meant the session cookie rode along on cross-site requests with no CSRF protection. SameSite cannot be tightened — client and API are on different origins — so state-changing requests from a declared-but-unknown origin are now rejected with 403. A missing Origin is still allowed: only a present-and-wrong one is evidence of an attack. |
| ~~S6~~ | `app.js` | **FIXED 2026-08-10.**  No security headers. `helmet` added, with `contentSecurityPolicy` off because the API serves JSON and the CSP belongs with the client. |
| ~~S7~~ | `chatSocket.js` | **FIXED 2026-08-10.**  No server-side message length or rate validation. The client's `maxlength="200"` is the only limit. |
| ~~S8~~ | `theaterRouter.js` | **FIXED 2026-08-10.**  The listing exposed `ownerID`. It stays public — browsing events before signing up is intended — but `ownerID` is now projected out, since no client view uses it. |
| ~~S10~~ | `loginRouter.js:84` | **FIXED 2026-08-10.** `PATCH /resetpassword` never checked that a token was supplied — `POST` did, `PATCH` did not. With `token` absent, `clientUser.token` is `undefined`, the driver serializes it to BSON `null`, and `{ passwordToken: null }` matches every document where the field is null **or absent**. One unauthenticated request containing only a victim's email replaced their password. Found by adversarial review of the S9/S1 fix, which had *not* closed the takeover: `mongo-sanitize` is structurally incapable of stopping it, because `null` is not an operator. Fixing S1 also moved users who had completed a legitimate reset from accidentally-shielded (a leftover `passwordToken` string did not match `null`) to exploitable. The control is now a type guard — `token` and `email` must be non-empty strings — on both routes. Regression tests: `passwordReset.test.js`, `describe("defect S10…")`, three cases including the completed-reset population. |
| ~~S9~~ | `app.js:85` | **FIXED 2026-08-10.** Necessary but not sufficient on its own — see S10. `sanitizeRequest` was registered before `express.json()` and before routing, so `req.body` was `undefined` when it ran and `sanitize(req.body)` was a no-op — `mongo-sanitize` was effectively an unused dependency and operator injection reached both `/resetpassword` queries. Moved after the body parser. Probing the other two vectors showed neither was ever exploitable: `req.params` values are always strings, and Express 5's default `"simple"` query parser cannot produce nested objects (`?t[$ne]=x` yields the literal string key `"t[$ne]"`) — Express 4's `"extended"` default could have. `req.query` is also a getter returning a fresh object per access, so mutating it was structurally incapable of working. The sanitizer now covers the body only, with `query parser` pinned to `"simple"` so widening it is a conscious act. Regression test: `passwordReset.test.js` ("rejects a Mongo operator supplied in place of a reset token"). |

### Introduced and closed same-day (2026-08-10)

| # | Location | Issue |
|---|---|---|
| ~~N1~~ | `app.js:87` | **FIXED 2026-08-10.** `mongo-sanitize` recurses without a depth limit. A ~40 kB body of nested arrays — well under body-parser's 100 kB default — overflows the stack. Express 5 catches the synchronous throw so the process survives, but an unauthenticated request that previously returned 400 now returns 500. New attacker-triggered error path, created by making the sanitizer actually run. Closed with an iterative depth walk capped at 32 before the sanitizer runs (iterative because a recursive guard would overflow on the same input). Measured: depth 2,000 was already fine, depth 10,000 produced the 500. Regression tests in `health.test.js` cover both the rejection and that normal nesting still reaches the route. |
| ~~N2~~ | `userRouter.js:7` | **FIXED 2026-08-10.** The sanitizer neutralises an operator into `{}` rather than rejecting it, so `POST /users` with `username: {"$ne": null}` changed from 400 "Username already exists" to 200 "User created", storing `username: {}` and putting it in the session. Data-integrity, not auth. Closed by requiring every signup field to be a non-empty string before anything reads it. This is the same lesson as S10: scrubbing inputs is a weaker control than typing them, and Phase 2's `zod` work should generalise it across every route. |

### Correctness

| # | Location | Issue |
|---|---|---|
| ~~C1~~ | `userRouter.js:26` | **FIXED 2026-08-10.** `clientUser.username < 3 \|\| clientUser.username > 16` compared a **string to a number**, so both comparisons were always false and username length was never validated — a one-character username was accepted. Now compares `.length`. The signup form already carried `maxlength="16"` but no `minlength`, so the client mirrored half the server rule; it now mirrors both. Regression tests cover every boundary (1, 2, 3, 16, 17) rather than one case, because the fix reintroduces a comparison that was silently absent rather than merely wrong. |
| ~~C2~~ | `InsideTheater.svelte` (throughout) | **FIXED 2026-08-10.** Each of the three countdowns turned a duration into `hh:mm:ss` by constructing `new Date(duration)` — a moment that many milliseconds after the epoch — and reading `getHours()`, `getMinutes()` and `getSeconds()` off it. Those are local-time accessors, so the viewer's UTC offset was added to the answer and a hardcoded `- 3600000` subtracted an hour to cancel it. That cancels exactly once: in CET during winter. Everywhere else, and in CET itself from March to October, the clock read an hour out; it also inherited `getHours()`' 0-23 wrap and rendered negative durations as times near midnight. Replaced by `services/duration.js`, which is arithmetic on a number with no `Date` involved, and the three inline blocks — about 70 lines of nested expressions — collapse to three `$derived` values. The chained conditions also close a one-millisecond gap where `currentTime === startTime` exactly fell through every branch to "Closed". Note: the machine this was fixed on sits at UTC+1, the single offset where the old code was correct, so the ordinary cases pass either way — the test that actually catches it is the one that varies `process.env.TZ`. |

| ~~C3~~ | `theaterRouter.js:155–166` | **FIXED 2026-08-10.** Slot allocation walked the sorted list reassigning `theater.position` on every mismatch without breaking, then fell back on `if (!theater.position)` — which cannot tell slot 0 from an unset slot. The deeper problem was that `theater` *was* `req.body.data`: the handler stored the request body itself and overwrote the fields it cared about, so a `position` the client sent survived whenever the loop happened not to overwrite it, and any other invented field was persisted verbatim. Allocation is now a `Set` lookup for the lowest free slot, and the stored document is built field by field. Tests cover seven slot layouts and three client-chosen positions — a client-sent `0` was masked by the falsy fallback, so only a truthy one exposed it. |

| ~~C4~~ | `theaterRouter.js:40` | **FIXED 2026-08-10.** `req.session.creatingEvent` was used as a mutex against double-creation, and it never held — not even on one instance. A session is written back to the store when the response ends, so two overlapping requests both read the flag as undefined and both proceed; a test firing two creations from one agent produced two events every time. The flag was also set before validation and cleared on each early return, so any path that missed one left it stuck true and the owner could never create an event again for the life of the session. Both uniqueness rules now live in unique indexes — `ownerID` (one live event per owner) and `position` (one theater per slot) — because the database is the only place that can decide atomically. An owner conflict is final and returns the ordinary message; a slot conflict just means someone took the gap first, so the insert recomputes and retries, capped at 10 attempts. `ensureIndex` drops and rebuilds an index whose options changed, since Mongo answers a tightened `createIndex` with IndexOptionsConflict rather than applying it. |

| ~~C5~~ | `theaterRouter.js:225` vs `chatSocket.js:47` | **FIXED 2026-08-10.** An occupant was added to `usersInsideTheater` by the HTTP join and removed by the socket's `disconnecting` handler. Anything that broke that pairing left a ghost holding a seat for the life of the theater: a tab closed before the socket opened, a dropped connection, or a restart, which clears every socket at once and so orphans every occupant of every theater simultaneously. Nothing reconciled the stored list against who was really there. Occupants are now `{ userID, joinedAt }`, and the listing and the capacity check reconcile the stored list against the live socket room, persisting the result. A 60-second grace period is what makes that safe — the join and the socket handshake are two round trips, so someone who has only just joined has no socket yet and must not be swept. Entries in the old bare-string format have no join time and sweep on first contact, which is intended: they predate any socket the process knows about. The load-bearing test is the one where an occupant past the grace period keeps their seat because their socket is open — without it the whole set would pass on the grace period alone, and it was verified to fail when the live-room check is removed. |

| ~~C6~~ | `theaterRouter.js` | **FIXED 2026-08-10.** `timeToClose` was written and never read, so closed theaters accumulated forever — holding a slot on the strip and, through the one-event-per-owner rule, permanently blocking their owner. A lazy sweep now deletes them on the listing and before the ownership check; the field is indexed. A scheduled job would be the alternative, but the listing is hit on every page load, which is trigger enough at this size. |
| ~~C7~~ | `TheaterFront.svelte`, `EmptyLot.svelte` | **CLOSED 2026-08-10.** `Math.floor(Math.random() * 5)` sat inline in the markup, and under Svelte 3 the whole update block re-ran on every reactive change — so the marquee changed colour once a second on every theater, since `TheaterFront` takes the ticking `currentTime`. The Svelte 5 runes migration closed it incidentally: runes only re-evaluate expressions that read reactive state, and `Math.random()` reads none. Verified in a browser rather than assumed — a Playwright test watches the class attribute across 2.5 seconds of ticking on a real theater, not an empty lot. The expression is now hoisted to a `const` so the behaviour is deliberate rather than a property of the compiler. (The line numbers in the original entry pointed at `InteractiveSpace.svelte`, before Phase 0.3 extracted the SVG art into its own components.) |

| ~~C8~~ | `api.js:6` | **CLOSED 2026-08-10.** `configuredApiUrl.replace(...)` threw at module scope if the build-time API URL was unset, taking the whole client down rather than degrading. Closed during the Phase 0.6 SvelteKit migration, which introduced `(PUBLIC_API_URL || "").replace(/\/$/, "")` while renaming the variable. Verified still present, not re-derived. |


### Operability

| # | Location | Issue |
|---|---|---|
| ~~O1~~ | `createConnection.js` | **FIXED 2026-08-10.** No indexes on any collection; every signup ran two full scans, one a collation query. Now indexed on `users.email` (unique), `users.username` (unique, collated), `theaters.position`, `theaters.ownerID` and `theaters.timeToClose`. The unique constraints also move the duplicate check out of application code, where two concurrent signups could both pass it. |
| ~~O2~~ | `theaterRouter.js:9` | ~~No `try`/`catch`; an unhandled rejection escapes the route.~~ **Resolved as of this branch.** Express 5 forwards a rejected promise returned from a route handler to the error-handling middleware automatically, and `app.js` now registers one (added for Task 11). `GET /theaters` throwing now produces a JSON 500 instead of an unhandled rejection. No code change was needed in `theaterRouter.js` itself. |
| ~~O3~~ | Everywhere | **FIXED 2026-08-10.** Everything went through `console.log`/`console.error`: prose, no level, no timestamp, and no way to tie a line to the request that produced it — under any concurrency that means reading interleaved output from several requests and guessing which lines belong together. `pino` + `pino-http` now emit one JSON object per line, and every line logged while serving a request carries a `requestId`. The id is returned in the `x-request-id` response header so a user reporting a failure can quote it, and an inbound value of that header is adopted rather than replaced, keeping one id across a proxy hop. The serializers are deliberately narrow — method, url, status — because pino-http's defaults record headers, and these requests carry session cookies, passwords and reset tokens; a test asserts a password and a session cookie never reach the output. `/health` logs at `debug` so a check every few seconds does not become the bulk of the log, while its failures still surface as `error`. |

| ~~O4~~ | `server.js` | **FIXED 2026-08-10.** SIGTERM and SIGINT now drain the HTTP server and close the Mongo client, with a 10s forced-exit backstop; previously the process died instantly, cutting in-flight requests. The second half is now closed too: `/health` pings Mongo and answers 503 `{status:"degraded"}` when it cannot be reached, instead of reporting 200 for as long as Node had not crashed. Every route reads or writes Mongo and sessions are stored there, so an instance without it can serve nothing — `DEPLOYMENT.md` already promised a bad database URI would keep the deployment unhealthy, and this extends that promise past boot. The ping carries its own 2s deadline, because the driver's `serverSelectionTimeoutMS` defaults to 30s and a health check that slow has already failed. Unit-tested against a fake client, since the interesting cases are Mongo being gone or hanging and `mongodb-memory-server` is up for the whole run. |

| ~~O5~~ | Both packages | **FIXED 2026-08-10.** No tests, lint, formatter, types or CI. There are now 154 server tests, 10 client unit tests and 22 client e2e tests, with eslint and prettier over both packages, all four gated in CI. Types remain the one part not done: the roadmap keeps them for a later phase rather than retrofitting TypeScript across a codebase that has just changed this much. |
| ~~O6~~ | `app.js:107` | **FIXED 2026-08-10.** `app.use(loginLimiter)` was path-less and registered ahead of `express.static`, the SPA fallback and the 404 handler, so every request that fell through routing spent the 10-per-15-minutes login bucket. Ten stray 404s from one NAT'd IP — a bot probing paths, a client typo — locked every user behind that IP out of `/login` for 15 minutes. The limiter is now scoped by path to `/login`, `/forgotpassword` and `/resetpassword`. Tests pin the scoping in both directions: unknown paths and ordinary reads no longer spend the bucket, and each protected endpoint still 429s, because a path list can silently lose an entry. The `SERVE_CLIENT=true` branch it sat in front of was removed in the same change — see the note below. |


| ~~O7~~ | `app.js:173` | **FOUND AND FIXED 2026-08-10.** Introduced by the SvelteKit migration. The `SERVE_CLIENT=true` branch served `client/public`, which that migration deleted — `public/` became `static/`, and the build output moved to `.vercel/output/static`. The branch could not be repointed either: `adapter-vercel` emits no `index.html` for the SPA fallback to send. So the branch was dead code that would have answered every request with a 500. Removed, along with its now-unused `path` and `fileURLToPath` imports and the `SERVE_CLIENT` line in `DEPLOYMENT.md` and `.env.example`. `validateConfig` now warns if anyone still sets it, so a stale deployment config says so at boot instead of silently doing nothing. |

### Corrected

An earlier read suggested `client/public/build/*` was committed. It is not —
`client/.gitignore:2` covers it. No action needed.

---

## 6. Explicitly not doing

- **Screen sharing over WebRTC.** It would make FlixDrive the pipe for unlicensed
  retransmission — copyright liability and DMCA exposure that undercuts the entire
  moderation story on a paid public product.
- **A licensed film catalog.** A content-acquisition business with CDN and transcoding
  costs, larger than the rest of this roadmap combined.
- **An SFU for voice/video.** Media is not monetized; mesh with a hard participant cap
  keeps the marginal cost at zero.
- **Monetizing media quality.** Explicitly rejected — it would put the entire WebRTC stack
  on the critical path to first revenue.

---

## 7. Open decisions

| Decision | Needed by |
|---|---|
| What happens to a film club when its owner stops paying? | Phase 8 |
| Age gate threshold — 13 or 16 — and whether EU users get a different one | Phase 9 |
| Whether camera ever opens beyond clubs and friends | Phase 9 |
| Express 4 → 5 is in Phase 0; whether Node 22 → 24 rides along | Phase 0 |

---

## 8. Risks

| Risk | Mitigation |
|---|---|
| Safety lands at Phase 9, after voice and camera ship | Invite-only flag until Phase 9; camera gated to clubs/friends in Phase 6; safety data models land in Phase 2 |
| Blind Svelte 5 migration with no client tests | Server characterization tests in 0.1; SVG extraction in 0.3 shrinks the migration surface by ~85% |
| Agent-authored code outpaces review capacity | CI gating from Phase 1; every Phase 0 step independently shippable |
| Phase 4 world rearchitecture is the largest technical risk | `instanceId` groundwork makes Phase 11 config rather than rewrite |
| An 18-month arc on evenings and weekends | Phases 3, 5 and 7 each ship visible player-facing value independently |

---

## 9. Next step

Phase 0 gets its own implementation plan. Each of its six steps is a separate PR.
