# Phase 0.4 — Replace svelte-navigator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove `svelte-navigator`, the only dependency pinning this app to Svelte 3, and replace it with ~40 lines of in-repo routing — so Phase 0.5's runes migration is unblocked and lands as its own reviewable change.

**Architecture:** The app has three routes and two navigation call sites. That does not need a router library, or even a `<Route>` component. A `location` store plus a `navigate()` function is enough; `App.svelte` matches on it with an `{#if}`. Phase 0.6 deletes all of it in favour of SvelteKit's file-based routing.

**Tech Stack:** Svelte 3.59.2 and Rollup 2, both unchanged. No build-tool work in this phase — see the note below.

## Why this is not the "Rollup → Vite" step the roadmap described

The roadmap's 0.4 was "Rollup → Vite, plus a throwaway router". Checking the actual compatibility matrix killed the Vite half:

- `@sveltejs/vite-plugin-svelte@7.3.0` (current) declares `svelte: ^5.46.4`, `vite: ^8`. It does not support Svelte 3.
- The newest plugin that does is `v2.x`, which pins `vite: ^4.0.0` — two majors behind.
- So "Vite while still on Svelte 3" means installing Vite 4, then replacing it again in 0.6.
- Meanwhile `rollup-plugin-svelte@7.2.3` declares `svelte: >=3.5.0` — open-ended. **Rollup can carry Svelte 5.**

So the sequence becomes 0.4 router → 0.5 runes on Rollup → 0.6 SvelteKit, which brings Vite 8 with it. The standalone Vite step is dropped as redundant rather than deferred. Update the roadmap accordingly in Task 5.

## Global Constraints

- **No behaviour changes.** Same URLs, same components, same guard. This is a dependency swap.
- **Do not touch anything under `server/`.** The 75-test suite must stay green.
- **Do not start the runes migration.** No `$state`, no `$props`, no `$derived`. Phase 0.5 owns that.
- The client still has **no automated tests**. Verification is a browser route matrix (Task 4) — the approach that caught the regressions in Phase 0.3, where source-level checks did not.
- Exact versions: `@zerodevx/svelte-toast@^0.9.6`, `svelte-loading-spinners@^0.3.6`. Installed Svelte is 3.59.2, which satisfies toast's `^3.57.0` floor.

---

## The complete routing surface

Everything `svelte-navigator` is used for, found by grep — this is the whole list:

| Site | Usage | Replacement |
|---|---|---|
| `App.svelte:3` | `import { Router, Route }` | `{#if}` on a `route` store |
| `App.svelte:59` | `<Route path="/" component={InteractiveSpace} />` | default branch |
| `App.svelte:61` | `<Route path="/theaters/:id" …>` guarded by `$user.loggedIn` | `{#if route.name === "theater" && $user.loggedIn}` |
| `App.svelte:64` | `<Route path="/*" component={InteractiveSpace} />` | same default branch |
| `TheaterInfoScreen.svelte:2,50` | `navigate("/theaters/" + theater._id)` | `navigate()` from the new module |
| `InteractiveSpace.svelte:11,21` | `useLocation()` → reads `$location.search` for `?position=` | `location` store from the new module |

Note `InsideTheater.svelte` navigates with `window.location.href = "/"` (full page loads, lines 76 and 94) and `InteractiveSpace.svelte:314` uses `window.location.reload()`. **Leave those alone.** They are outside the router's concern and changing them would be a behaviour change.

---

## Task 1: Write the routing module

**Files:**
- Create: `client/src/lib/router.js`

**Interfaces:**
- Produces `client/src/lib/router.js` exporting:
  - `location` — a writable store of `{ pathname, search }`, updated on `popstate` and on `navigate()`
  - `navigate(to)` — pushes a history entry and updates the store
  - `route` — a derived store of `{ name, params }`; `name` is `"theater"` for `/theaters/:id` and `"world"` otherwise

- [ ] **Step 1: Create the module**

```javascript
import { writable, derived } from "svelte/store";

function read() {
    return { pathname: window.location.pathname, search: window.location.search };
}

export const location = writable(read());

function sync() {
    location.set(read());
}

window.addEventListener("popstate", sync);

export function navigate(to) {
    if (to === window.location.pathname + window.location.search) return;
    window.history.pushState({}, "", to);
    sync();
}

const THEATER = /^\/theaters\/([^/]+)\/?$/;

export const route = derived(location, ($location) => {
    const match = THEATER.exec($location.pathname);
    return match ? { name: "theater", params: { id: match[1] } } : { name: "world", params: {} };
});
```

Two details that matter:

Use `writable`, not `readable`. A `readable` only hands you its `set` inside the start function, which runs on first subscribe — capturing it in a module-level variable to use from `navigate()` works, but it is a timing trick that breaks silently if the store ever has no subscriber. A `writable` has no such subtlety. The `popstate` listener is never removed, which is correct for a module that lives as long as the app.

The regex requires a non-empty id and tolerates a trailing slash. `/theaters/` alone falls through to the world route, matching how `svelte-navigator` treats a missing param.

- [ ] **Step 2: Verify it in isolation before wiring anything to it**

```bash
cd client && node --input-type=module -e "
globalThis.window = { location: { pathname: '/theaters/abc123', search: '?x=1' }, addEventListener(){}, removeEventListener(){}, history:{pushState(){}} };
const { route, location } = await import('./src/lib/router.js');
let r; route.subscribe(v => r = v)();
let l; location.subscribe(v => l = v)();
console.log('route:', JSON.stringify(r));
console.log('location:', JSON.stringify(l));
"
```

Expected: `route: {"name":"theater","params":{"id":"abc123"}}` and the location reflecting the stubbed pathname/search. If the id comes back `undefined`, the regex capture is wrong — fix it before continuing.

- [ ] **Step 3: Commit**

```bash
git add client/src/lib/router.js
git commit -m "feat: add a minimal in-repo router to replace svelte-navigator"
```

---

## Task 2: Switch `App.svelte` to the new router

**Files:**
- Modify: `client/src/App.svelte`

**Interfaces:**
- Consumes `route` from Task 1.
- Produces: `App.svelte` no longer imports `svelte-navigator`.

- [ ] **Step 1: Replace the import and the router markup**

Remove `import { Router, Route } from "svelte-navigator";` and add:

```javascript
	import { route } from "./lib/router.js";
```

Replace the `<Router>…</Router>` block — keeping the `<main>` element, its `style` attribute and everything else exactly as-is:

```svelte
<main
	style="--stage-scale: {stageLayout.scale}; --stage-height: {stageLayout.height}px; --stage-width: {stageLayout.width}px; --scene-offset: {stageLayout.sceneOffset}px;"
>
	{#if $route.name === "theater" && $user.loggedIn === true}
		<InsideTheater id={$route.params.id} />
	{:else}
		<InteractiveSpace />
	{/if}
</main>
```

This preserves the original semantics exactly: a logged-out user hitting `/theaters/:id` fell through `svelte-navigator`'s guarded route to the `/*` catch-all and got `InteractiveSpace`. The `{:else}` does the same.

- [ ] **Step 2: Build and confirm it compiles**

```bash
cd client && API_URL=http://localhost:5000 npm run build
```

- [ ] **Step 3: Commit**

```bash
git add client/src/App.svelte
git commit -m "refactor: route in App.svelte without svelte-navigator"
```

---

## Task 3: Switch the two remaining call sites

**Files:**
- Modify: `client/src/components/TheaterInfoScreen.svelte`, `client/src/pages/InteractiveSpace.svelte`

- [ ] **Step 1: `TheaterInfoScreen.svelte`**

Change `import { navigate } from "svelte-navigator";` to:

```javascript
    import { navigate } from "../lib/router.js";
```

The call at line 50 is unchanged.

- [ ] **Step 2: `InteractiveSpace.svelte`**

Replace `import { useLocation } from "svelte-navigator";` with:

```javascript
  import { location } from "../lib/router.js";
```

and delete the `const location = useLocation();` line — the import now provides `location` directly. Every `$location` usage stays as it is.

Verify the `?position=` handling still reads the same shape:

```bash
cd client && grep -n '\$location' src/pages/InteractiveSpace.svelte
```

Both uses read `$location.search`, which the new store provides.

- [ ] **Step 3: Confirm nothing still imports the old package**

```bash
cd client && grep -rn "svelte-navigator" src/ || echo "clean"
```

Expected: `clean`.

- [ ] **Step 4: Build and commit**

```bash
cd client && API_URL=http://localhost:5000 npm run build
git add client/src
git commit -m "refactor: move the last two call sites off svelte-navigator"
```

---

## Task 4: Verify every route in a browser, then drop the dependency

The client has no automated tests, so this matrix is the safety net. In Phase 0.3 the source-level checks passed while two real rendering regressions shipped; only browser measurement caught them.

**Files:**
- Modify: `client/package.json` (+ lockfile)

- [ ] **Step 1: Start a real backend and serve the built client**

The API cannot run without MongoDB, so boot an in-memory one. Note the app's own server listens on 5000 by default, which **macOS AirPlay Receiver also uses** — use 5055.

```bash
cd server
cat > devserver.mjs <<'EOF'
import { MongoMemoryServer } from "mongodb-memory-server";
const mongo = await MongoMemoryServer.create();
process.env.MONGODB_URI = mongo.getUri();
process.env.SESSION_SECRET = "dev-secret-at-least-32-characters-long";
process.env.CLIENT_ORIGINS = "http://localhost:8123";
process.env.OMDB_API_KEY = "dev";
const { server } = await import("./app.js");
const db = (await import("./database/createConnection.js")).default;
const now = Date.now();
await db.theaters.insertMany([0, 1, 2].map(i => ({
  eventName: ["Movie Night", "Sci-Fi Fest", "Noir Evening"][i],
  startTime: new Date(now + 3600000), timeToClose: new Date(now + 10800000),
  amountOfSpaces: 10, position: i, ownerID: "000000000000000000000001",
  usersInsideTheater: [], passwordBool: false, password: "",
  imdbID: "tt000000" + i, movieName: ["The Matrix", "Blade Runner", "Chinatown"][i],
  movieRuntime: 136, movieReleaseYear: "1999", imdbRating: "8.7",
  hrefPoster: "", moviePlot: "", movieGenres: "Action",
})));
server.listen(5055, () => console.log("READY"));
EOF
node devserver.mjs &
```

```bash
cd client && API_URL=http://localhost:5055 npm run build && npx sirv public --no-clear --single --dev --port 8123 &
```

**Use `--dev`.** Without it `sirv` caches aggressively and will serve a stale or half-written bundle; a truncated bundle presents as `Unexpected end of input` and a blank page, which looks exactly like a code bug and is not one. If you see that, compare `curl -s localhost:8123/build/bundle.js | wc -c` against `wc -c < public/build/bundle.js` before debugging anything else.

- [ ] **Step 2: Walk the route matrix**

For each, record what rendered:

| URL | Expected |
|---|---|
| `/` | the drive-in scene |
| `/?position=1` | the drive-in scene, player teleported to slot 1 |
| `/theaters/$ID` while logged out (get an id with `curl -s localhost:5055/theaters \| head -c 60`) | falls back to the drive-in scene |
| `/anything/else` | the drive-in scene |
| clicking a theater then "Join" | navigates to `/theaters/:id`, URL bar updates without a full reload |
| browser Back after that join | returns to `/`, scene re-renders |

The last two matter most: they exercise `navigate()` and `popstate`, which are the only parts of `svelte-navigator` this replaces that a static check cannot cover.

Reaching the join flow requires signing up through the UI first — the seeded database has theaters but no users.

- [ ] **Step 3: Remove the dependency and bump the two stale ones**

```bash
cd client
npm uninstall svelte-navigator
npm install @zerodevx/svelte-toast@^0.9.6 svelte-loading-spinners@^0.3.6
API_URL=http://localhost:5055 npm run build
```

Toast 0.9.6 requires Svelte `^3.57.0`; installed is 3.59.2, so this is safe now rather than after 0.5.

- [ ] **Step 4: Re-run the matrix after the bumps**

The toast and spinner bumps cross a minor version each. Re-walk Step 2, and additionally confirm a toast still appears (trigger one by submitting the login form with a bad password) and the loading spinner still renders (visible briefly on first load, or by throttling the network).

- [ ] **Step 5: Tear down and commit**

```bash
pkill -f "sirv public"; pkill -f devserver.mjs; rm -f server/devserver.mjs
git status --short   # must show no stray files
git add client/package.json client/package-lock.json
git commit -m "chore: drop svelte-navigator and bump toast and spinners"
```

---

## Task 5: Correct the roadmap's Phase 0 sequence

The roadmap and the Phase 0 plan both describe 0.4 as "Rollup → Vite, plus a throwaway router" and 0.6 as "Vite SPA → SvelteKit". The Vite half of 0.4 is redundant, for the compatibility reasons at the top of this document.

**Files:**
- Modify: `docs/superpowers/specs/2026-08-09-flixdrive-roadmap-design.md`

- [ ] **Step 1: Rewrite the step table**

| Step | New description |
|---|---|
| 0.4 | Replace `svelte-navigator` with an in-repo router; bump toast and spinners. Stays on Svelte 3 + Rollup |
| 0.5 | Svelte 3 → 5 runes, still on Rollup (`rollup-plugin-svelte` peer is `svelte: >=3.5.0`) |
| 0.6 | Rollup → SvelteKit, which brings Vite 8 and `adapter-vercel` |

Record *why*: `@sveltejs/vite-plugin-svelte@7` requires Svelte 5, the newest plugin supporting Svelte 3 pins Vite 4, and standing up a Vite 4 config that 0.6 immediately replaces is churn for no gain.

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers
git commit -m "docs: drop the redundant standalone Vite step from Phase 0"
```

---

## Done criteria

- `grep -rn "svelte-navigator" client/src` returns nothing, and it is absent from `package.json` and the lockfile.
- `client/src/lib/router.js` is under 50 lines.
- Every row of the Task 4 matrix behaves as described, including Back after a join.
- `npm run build` is clean; CI's Client build job is green.
- The server suite is still 75/75.
- No `$state`/`$props`/`$derived` anywhere — the runes migration has not started.

## Not in this plan

Phase 0.5 (Svelte 5 runes) and 0.6 (SvelteKit, bringing Vite). The `window.location.href` navigations in `InsideTheater.svelte` stay as full page loads; converting them is a behaviour change and belongs with the core-loop work in Phase 3.
