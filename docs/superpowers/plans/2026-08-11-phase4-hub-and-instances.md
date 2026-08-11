# Phase 4 — Hub and instanced spaces

**Spec:** `docs/superpowers/specs/2026-08-09-flixdrive-roadmap-design.md`, Phase 4.

**Exit criteria (from the spec):** two lobbies run simultaneously in separate instances; a
client only receives position updates for players it can see.

The spec calls this "the largest technical risk" in the roadmap, and the risk table says
the mitigation is that the `instanceId` groundwork makes Phase 11 config rather than a
rewrite. That framing shapes the plan: the point is to put the seams in, not to build
sharding nobody needs yet.

## Global constraints

- One hub instance will exist for a long time. Everything here must be a no-op at that
  scale, or it is a cost with no payer.
- The world has to keep feeling responsive. A change that makes driving laggy has failed
  regardless of what it fixes.
- Tests first, CI green across all four jobs.

---

## Decision: "server-authoritative movement" means validated, not simulated

The spec says **"Server-authoritative movement. Today the client is authoritative and
trivially spoofable."** Two readings:

1. **Full simulation.** The client sends input intent, the server integrates on a fixed
   tick and broadcasts positions, and the client predicts locally and reconciles.
2. **Server-held, validated position.** The client integrates locally and proposes a
   position; the server keeps its own authoritative copy and accepts a proposal only when
   it is reachable given elapsed time and the world's speed limit, correcting the client
   otherwise.

**Reading 2 is what gets built**, with the reasoning stated rather than assumed:

- The named problem is spoofability, and validation closes it. Teleporting, speed hacks
  and out-of-bounds positions all become impossible; the server's copy is the truth and a
  rejected proposal is corrected.
- Position integrity stopped being cosmetic in Phase 3. Proximity chat decides who hears a
  message from the server's position, so a spoofed position is an eavesdropping tool, not
  just an unfair advantage. Validation fixes exactly that.
- Full simulation buys consistency of physics and immunity to momentary desync. For a hub
  where people drive between lots with nothing competitive at stake, that is a small gain
  for a rewrite of the movement loop — the change most likely to make the world feel
  worse, which the constraints above rule out.

**What would change this:** anything with stakes attached to position — a race, a
contested resource, a queue where being first matters. None exist, and when one is
proposed this decision should be revisited rather than inherited.

## Decision: interest management uses a grid, not a scan

Sending only nearby players means answering "who is near this player" on every position
update. Comparing against every other player is O(n²) per tick, which is exactly what
this phase exists to avoid.

Positions go into a uniform grid keyed by cell, and a query reads the nine cells around
the subject. At one instance and small numbers the difference is irrelevant; the point is
that the shape does not have to change when it stops being irrelevant.

---

## Task 1: The hub as an instance

**Files:** `server/world/instances.js` (new), `server/socketios/carSocket.js`,
`server/config.js`, `DEPLOYMENT.md`

Every socket in the world belongs to exactly one hub instance and joins a socket.io room
named for it. World broadcasts address that room rather than every connected socket.

- `HUB_CAPACITY` (default 60) bounds one instance.
- Joining a full instance is refused with a clear reason; with one instance configured
  that is the whole answer, and Phase 11 replaces it with "allocate another".
- The instance a socket joined is on `socket.data`, so nothing trusts a client-supplied id.

At one instance this changes no observable behaviour, which is the point: the seam exists
and is exercised, so Phase 11 is configuration.

## Task 2: Server-held positions

**Files:** `server/world/movement.js` (new), `server/socketios/carSocket.js`,
`client/src/lib/pages/InteractiveSpace.svelte`

The server keeps `{ x, y, at }` per socket and accepts a proposed position only if:

- both coordinates are finite numbers, and
- the position is inside the world bounds, and
- the distance from the last accepted position is within `MAX_SPEED × elapsed`, with a
  tolerance for frame jitter and latency.

A rejected proposal does not move the server's copy, and the client is told where it
actually is so it can correct rather than silently diverge.

The bounds and the speed limit have to match the client's own — 250 px/s, y within
410–725 — or honest players get corrected for playing normally.

## Task 3: Interest management

**Files:** `server/world/grid.js` (new), `server/socketios/carSocket.js`,
`client/src/lib/pages/InteractiveSpace.svelte`

A position update goes only to players within `INTEREST_RADIUS`. Crossing the boundary is
an event in its own right:

- entering someone's radius sends them a `newCarJoined`, so the car appears
- leaving sends `carLeft`, so it does not freeze in place forever

Without those two, interest management looks like a bug: cars stop updating and stay
where they were last seen.

## Task 4: Two lobbies at once

**Files:** `server/test/lobbyIsolation.test.js` (new)

Playback state and chat are already per-theater, so this is likely already true — which
is worth proving rather than assuming. Two theaters, two showings, and neither one's
play/pause, chat or ready-check reaches the other.

Anything that leaks is a defect this phase fixes.

---

## Order

1, 2, 3, 4. Instances first because the broadcast scoping is the seam the other two use;
interest management after validated positions, because filtering by position is only
meaningful once positions are trustworthy.
