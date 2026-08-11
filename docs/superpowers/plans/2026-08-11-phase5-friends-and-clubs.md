# Phase 5 — Friends and film clubs

**Spec:** `docs/superpowers/specs/2026-08-09-flixdrive-roadmap-design.md`, Phase 5.

**Exit criterion (from the spec):** a club can hold a recurring film night with a stable
membership and a public page.

The spec calls this "the retention and monetization centrepiece — people stay for groups",
and names club discovery as "where SvelteKit's SSR starts paying rent". That last part is a
commitment: Phase 0.6 turned SSR off app-wide because no route could support it, and this
phase produces the first one that can.

## Global constraints

- Tests first, CI green across all four jobs.
- Nothing here may weaken what Phase 4 established: positions are the server's, and a
  client is told only what it can see.
- Phase 8 wires club limits to entitlements. Anything that will become a paid boundary
  should be a number in one place, not a literal spread across routes.

---

## Decision: one row per friendship, with the pair ordered

A friendship could be two rows — "A follows B" and "B follows A" — or one row describing
the pair. **One row**, with the two ids stored in a canonical order (lexicographically
smaller first).

The reason is the unique index. Friendship is symmetric, so A requesting B and B requesting
A are the same relationship, and both must not be able to exist at once. Ordered ids make
that a plain unique index on `{ pairLow, pairHigh }`, which the database enforces against
two simultaneous requests. Unordered, the index cannot see that `(A,B)` and `(B,A)` are the
same thing, and the check falls back to application code — where two concurrent requests
both pass it, which is exactly the shape of defect C4.

The row keeps `requesterID` separately, because who asked still matters: only the person
who did *not* ask may accept.

## Decision: a recurring schedule is a wall clock and a zone, not an instant

A club that meets "Thursdays at 20:00 in Copenhagen" means 20:00 as read on a Copenhagen
clock. Stored as a UTC instant, that becomes 19:00 or 21:00 the moment the clocks change,
and every member gets an hour wrong twice a year.

The schedule is therefore `{ weekday, hour, minute, timeZone }` with an IANA zone name, and
the next occurrence is computed from it on demand. This is the same class of mistake as
defect C2 and the same reason it survived: the machine this is developed on sits at UTC+1,
where several wrong implementations look right. Tests fix the zone explicitly rather than
inheriting it.

## Decision: SSR is enabled per route, not app-wide

`+layout.js` sets `ssr = false` because `InteractiveSpace` and `InsideTheater` open a
socket at component-init scope and `userStore` reads `localStorage` at module scope. None
of that changed.

A public club page has none of those problems: it is a read-only view of data the server
can fetch. So SSR is turned on for that route alone, which is what the setting is for. The
app-wide default stays off, because the reasons it was turned off are still true.

---

## Task 1: Friends

**Files:** `server/services/friendService.js`, `server/routers/friendRouter.js`,
`server/schemas.js`, `server/database/createConnection.js`, client friends panel

- `POST /friends` — request, by username
- `PATCH /friends/:id` — accept or decline; only the addressee may
- `DELETE /friends/:id` — remove, either side
- `GET /friends` — accepted friends with presence, plus incoming and outgoing requests

Presence comes from the socket layer, which already knows who is connected — it is the same
question `presence.js` answers for theaters, asked of the hub.

Join-a-friend teleports to the friend's world position, which the server already holds
since Phase 4. It refuses when they are inside a theater the joiner cannot enter.

## Task 2: Clubs

**Files:** `server/services/clubService.js`, `server/routers/clubRouter.js`,
`server/schemas.js`, `server/database/createConnection.js`, client club screens

- `clubs`: name, slug, description, ownerID, isPublic, schedule, createdAt
- `clubMembers`: clubID, userID, role, joinedAt — unique per pair
- Roles: owner, moderator, member. Only an owner may delete a club or change roles; a
  moderator may remove members; a member may leave.
- The slug is generated from the name and unique, because it appears in a URL.
- History: past showings the club held, appended when a theater it owns closes.

## Task 3: Public club pages

**Files:** `client/src/routes/clubs/[slug]/+page.js`, `+page.server` equivalent,
`client/src/routes/clubs/[slug]/+page.svelte`, `server/routers/clubRouter.js`

A public club page shows the club, its next meeting in the viewer's own timezone, and its
recent history. It renders on the server so a link to it is worth sharing.

Only public clubs are exposed. A private club answers 404 rather than 403, since the
difference tells an unauthorised viewer that the club exists.

---

## Order

1, then 2, then 3. Friends first because it is the smaller of the two data models and
establishes the pair-ordering pattern clubs reuse for membership. Public pages last,
because they render what the first two produce.
