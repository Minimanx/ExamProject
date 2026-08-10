# Phase 0.5 — Svelte 3 → 5 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the client from Svelte 3.59.2 to Svelte 5, converting all 14 components to runes, while the app stays working after every commit.

**Architecture:** Two separable moves. First upgrade the *dependency* and leave every component in Svelte 5's legacy mode — the only forced change is `main.js`, because `new Component()` no longer exists. Then convert components to runes one at a time, smallest first, largest last. The app runs at every step.

**Tech Stack:** Svelte 5.56.8 on Rollup 2.80. `rollup-plugin-svelte@7.2.3` declares `svelte: >=3.5.0`, so the existing build carries Svelte 5 — no build-tool change in this phase. SvelteKit and Vite arrive in 0.6.

## Global Constraints

- **The app must work after every commit.** Legacy mode makes that possible; do not batch conversions.
- **Do not touch anything under `server/`.** The 75-test suite must stay green.
- Do not adopt SvelteKit, Vite, or file-based routing. Phase 0.6 owns those.
- The client has **no automated tests**. Verification is the browser matrix in the appendix, run per task.
- Exact version: `svelte@^5.56.8`.

---

## The one rule that makes this dangerous

Svelte 5 supports legacy mode **per component**. From the migration docs: *"Legacy mode features are unavailable once a component enters runes mode."*

A component enters runes mode the moment **any** rune appears in it. At that point plain `let` stops being reactive — silently. No error, no warning, no build failure. The component simply stops re-rendering when that variable changes.

So converting a component is **all-or-nothing**. Writing `let { theater } = $props()` at the top of a file whose body mutates `let messages = []` breaks the message list, and nothing tells you.

Every task below therefore lists the exact variables that must become `$state` in the components it touches. Those lists come from a survey of the current source; **verify each against the file** rather than trusting this document — a variable mutated only inside a nested closure is easy to miss with a regex.

---

## Migration surface

Measured across all 14 components:

| Idiom | Count | Action |
|---|---|---|
| `export let` | 12, in 8 components | → `$props()` |
| `$:` reactive | 2, both in `InteractiveSpace.svelte` | → `$derived` |
| `on:event` | 92 | → `onevent` in Task 7 |
| `bind:value` / `bind:this` / `bind:clientWidth` | 17 / 2 / 1 | unchanged in Svelte 5 |
| `svelte:window` | 1 | unchanged |
| `onMount` | 6 | still supported |
| `<slot>` and `createEventDispatcher` | **0** | nothing to do — the hard parts are absent |
| store subscriptions (`$user`, `$playerMovement`, `$route`, `$location`) | 43 | stores work unchanged in Svelte 5 |

Four art components (`Skyline`, `StreetSign`, `LogoutIcon`, `EmptyLot`) have **no `<script>` at all** and need no work.

---

## Task 1: Upgrade the dependency, keep every component in legacy mode

The "does it even run" gate. Only `main.js` changes.

**Files:**
- Modify: `client/package.json` (+ lockfile), `client/src/main.js`

**Interfaces:**
- Produces: Svelte 5 installed, app booting through `mount()`. Every component still legacy-mode and untouched.

- [ ] **Step 1: Install Svelte 5**

```bash
cd client && npm install --save-dev svelte@^5.56.8
```

- [ ] **Step 2: Switch the entry point to `mount()`**

Svelte 5 removed the class component API — `new App({ target })` throws. Replace the whole of `client/src/main.js`:

```javascript
import { mount } from 'svelte';
import App from './App.svelte';

const app = mount(App, {
	target: document.body
});

export default app;
```

- [ ] **Step 3: Build and read every warning**

```bash
cd client && API_URL=http://localhost:5055 npm run build 2>&1 | tee /tmp/svelte5-build.log
grep -icE "warn|deprecat|legacy" /tmp/svelte5-build.log
```

Expect a large number of legacy/deprecation warnings — `on:` handlers alone are 92. **That is the expected state, not a failure.** What matters is that there are no *errors*. Record the distinct warning codes:

```bash
grep -oE "[a-z_]+_deprecated|legacy_[a-z_]+|[a-z_]+_invalid" /tmp/svelte5-build.log | sort | uniq -c | sort -rn
```

Put that table in your report — it is the work list for Task 7 and a check that nothing unexpected appeared.

- [ ] **Step 4: Verify `svelte-loading-spinners` still works**

Its 0.3.6 release declares **no peer dependencies at all**, so npm will not warn if it is incompatible. It is used in `InteractiveSpace.svelte` and `InsideTheater.svelte` (`<Pulse …>`).

Confirm the bundle still contains it and that it renders — the spinner shows while theaters load, so throttle the network or check immediately after a hard reload. If it is broken, stop and report; replacing it with CSS is a decision, not a fix to improvise.

- [ ] **Step 5: Run the full browser matrix (appendix)**

Every row must pass with **zero** component files changed. If something is broken here, it is a Svelte 5 legacy-mode incompatibility and needs reporting before any conversion starts.

- [ ] **Step 6: Commit**

```bash
git add client/package.json client/package-lock.json client/src/main.js
git commit -m "feat: upgrade to Svelte 5, all components still in legacy mode"
```

---

## Task 2: Convert the two art components with props

Smallest possible conversion: props only, no mutable state, no event handlers.

**Files:**
- Modify: `client/src/art/Car.svelte`, `client/src/art/TheaterFront.svelte`

- [ ] **Step 1: `Car.svelte`**

Replace the three declarations with one `$props()` call. **Keep the no-defaults decision** — a Svelte 5 prop default fires on `undefined` exactly as a Svelte 3 one did, and a remote car has no `direction` until it first moves. Defaulting `facingLeft` would mirror every car on join; that bug was found and fixed in Phase 0.3 and must not come back.

```svelte
<script>
  // No defaults: a prop default fires on `undefined`, and a remote car has no
  // `direction` until it first moves. Defaulting facingLeft would mirror every
  // car on join.
  let { name, color, facingLeft } = $props();
</script>
```

- [ ] **Step 2: `TheaterFront.svelte`**

```svelte
<script>
  let { theater, currentTime } = $props();
</script>
```

- [ ] **Step 3: Verify**

Build, then check in the browser: cars render facing the right way, theater fronts show event name, times, runtime, occupancy and the movie title. Confirm a *newly joined* remote car is not mirrored — that is the Phase 0.3 regression this task could reintroduce.

- [ ] **Step 4: Commit**

```bash
git add client/src/art
git commit -m "refactor: convert the art components to runes"
```

---

## Task 3: Convert the three small components

**Files:**
- Modify: `client/src/components/AboutPage.svelte`, `client/src/components/TheaterInfoScreen.svelte`, `client/src/components/TheatersListView.svelte`

Variables that must become `$state` — verify each against the file:

| Component | Props → `$props()` | Must become `$state` |
|---|---|---|
| `AboutPage.svelte` | `aboutPageBool` | none |
| `TheaterInfoScreen.svelte` | `theater` | `joining`, `result` |
| `TheatersListView.svelte` | `theaters`, `teleportToTheater` | `sortBySpacesPicker`, `sortByNamePicker`, `sortByTimePicker`, `sortByDatePicker` |

- [ ] **Step 1: `AboutPage.svelte` needs `$bindable()`**

Checked against the parent: `InteractiveSpace.svelte:398` passes it as `<AboutPage bind:aboutPageBool />`, and `AboutPage.svelte:5` writes `aboutPageBool = false` to close itself. That is a two-way binding, so in runes mode the prop must be declared bindable or the panel will open and never close:

```svelte
let { aboutPageBool = $bindable() } = $props();
```

The other two are one-way and need no such treatment — `<TheaterInfoScreen theater={currentTheater} />` (line 392) and `<TheatersListView {theaters} {teleportToTheater} />` (line 390), neither of which writes to its props.

`CreateEventScreen` is the same two-way case (`bind:createEventBool` at line 395) and is handled in Task 4.

- [ ] **Step 2: Convert all three**

`export let x` → destructure from `$props()`. Every variable in the `$state` column above → `let x = $state(initial)`.

- [ ] **Step 3: Verify**

- About panel opens and closes
- Theater info panel opens, Join works, the "joining" spinner/disabled state behaves as before
- The list view's four sort controls each re-sort and their indicator updates

- [ ] **Step 4: Commit**

```bash
git add client/src/components
git commit -m "refactor: convert the small components to runes"
```

---

## Task 4: Convert the two form components

The most `$state` per file, and the most `bind:value`.

**Files:**
- Modify: `client/src/components/LoginScreen.svelte`, `client/src/components/CreateEventScreen.svelte`

| Component | Props | Must become `$state` |
|---|---|---|
| `LoginScreen.svelte` | `socket` | `email`, `username`, `password`, `passwordRepeat`, `token`, `loginComponent`, `signUpComponent`, `forgotPassComponent`, `tokenComponent`, `changePassComponent` |
| `CreateEventScreen.svelte` | `createEventBool` — **two-way**, needs `$bindable()` (parent binds at `InteractiveSpace.svelte:395`; child writes `createEventBool = false` at line 90) | `password`, `loadingMovieSearch`, `movies` |

`bind:value` still works in Svelte 5, but **only against `$state`**. A `bind:value` pointed at a plain `let` in a runes-mode component is exactly the silent breakage this plan warns about: typing appears to work (the DOM updates) while the variable never changes, so submission sends empty strings.

`CreateEventScreen`'s `timeoutID` holds a `setTimeout` handle for the movie-search debounce. It is mutated but never read in the template — it does **not** need `$state`, and wrapping it costs a needless re-render. Use judgement rather than converting every `let` mechanically.

- [ ] **Step 1: Convert `LoginScreen.svelte`**

The five `*Component` booleans drive which panel shows. All five must be `$state` or the screen freezes on the login panel.

- [ ] **Step 2: Convert `CreateEventScreen.svelte`**

- [ ] **Step 3: Verify — this is the task most likely to break silently**

- Log in with correct credentials → succeeds
- Log in with wrong password → error toast, form still usable
- Sign Up panel opens, all four fields accept input, submitting creates a user
- Forgot Password → token panel → change password, each panel transition works
- Create Event: type a movie title, results appear (debounced), select one, submit creates the theater

For each form, confirm the *submitted values* arrive at the server, not just that typing looks right. The network tab or the server log is the evidence; the DOM is not.

- [ ] **Step 4: Commit**

```bash
git add client/src/components
git commit -m "refactor: convert the form components to runes"
```

---

## Task 5: Convert `App.svelte` and `InsideTheater.svelte`

**Files:**
- Modify: `client/src/App.svelte`, `client/src/pages/InsideTheater.svelte`

| Component | Props | Must become `$state` |
|---|---|---|
| `App.svelte` | none | `stageLayout` |
| `InsideTheater.svelte` | `id` | `theater`, `messages`, `sendMessage`, `timeLeftInMovie`, `hoursLeft`, `minutesLeft`, `secondsLeft`, `currentTime`, `scrollFrameId`, `active` |

`App.svelte`'s `stageLayout` is reassigned on every resize and feeds the CSS custom properties that Phase 0.4's width fix depends on. If it is not `$state`, the stage stops responding to resize — and the black bars come back.

In `InsideTheater.svelte`, `scrollFrameId` and `active` are bookkeeping handles never read in the template; they do not need `$state`.

- [ ] **Step 1: Convert both**

- [ ] **Step 2: Verify**

- Resize the window and confirm the stage still fills edge to edge, at several aspect ratios (this is the Phase 0.4 fix — regression here is easy)
- Enter a theater: the countdown ticks every second, chat messages appear and the list auto-scrolls, sending a message clears the input

- [ ] **Step 3: Commit**

```bash
git add client/src/App.svelte client/src/pages/InsideTheater.svelte
git commit -m "refactor: convert App and InsideTheater to runes"
```

---

## Task 6: Convert `InteractiveSpace.svelte`

The largest: 15 variables needing `$state` and both `$:` statements in the codebase.

**Files:**
- Modify: `client/src/pages/InteractiveSpace.svelte`

Must become `$state`: `cars`, `theaters`, `keys`, `keyDown`, `playerCoords`, `insideTheaterBool`, `currentTheater`, `playerDirection`, `screenScrollAmount`, `canvasLength`, `createEventBool`, `aboutPageBool`, `occupiedSlots`, `theatersLoaded`, `currentTime`.

The two reactive statements become `$derived`:

```javascript
  let playerName = $derived($user.username || "");
  let highestPosition = $derived(
    Math.max(3, Math.ceil(canvasLength / 400), occupiedSlots)
  );
```

Three specific hazards in this file:

**`playerCoords` is mutated in place** — `playerCoords.x = …` inside the animation loop, roughly 60 times a second. With `$state`, deep mutation is reactive (it is a proxy), so this keeps working. Do **not** rewrite it to reassign the whole object; that would be a behaviour change and a performance regression on a hot path.

**`keys` is mutated by key handlers** (`keys[key] = true`) and read in the same loop. Same proxy behaviour applies.

**`canvasLength` is `bind:clientWidth`** and feeds the derived `highestPosition`. Phase 0.4 established that `highestPosition` must be derived, not assigned, because the element it measures only exists once the scene renders. Preserve that shape exactly.

- [ ] **Step 1: Convert the file**

- [ ] **Step 2: Verify the game actually plays**

Static checks cannot cover this. With a logged-in session:

- WASD moves the car and it animates smoothly
- Driving right past the trigger scrolls the world; driving left scrolls back
- Parking at a theater opens the info panel; leaving closes it
- The `?position=N` deep link teleports to the right slot
- The clock in the theater cards updates
- Open a second browser and confirm the two cars see each other move

The last one exercises the socket path feeding `cars`, which is the variable most likely to be missed.

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/InteractiveSpace.svelte
git commit -m "refactor: convert InteractiveSpace to runes"
```

---

## Task 7: Modernise event handlers and clear the warnings

With every component in runes mode, `on:click` is legacy syntax. Converting removes the deprecation warnings and is what 0.6 expects.

**Files:**
- Modify: every component with an `on:` handler (9 files, 92 handlers)

- [ ] **Step 1: Convert `on:event={handler}` to `onevent={handler}`**

`on:click` → `onclick`, `on:submit` → `onsubmit`, `on:input` → `oninput`, and so on. `<svelte:window on:keydown|on:keyup>` becomes `<svelte:window onkeydown onkeyup>`.

Watch for modifiers. Svelte 5 removed `|preventDefault` and friends; if any handler uses one, it becomes an explicit call inside the handler. Check first:

```bash
cd client && grep -rn "on:[a-z]*|" src/ || echo "no modifiers — straight rename"
```

- [ ] **Step 2: Confirm the warnings are gone**

```bash
cd client && API_URL=http://localhost:5055 npm run build 2>&1 | grep -icE "deprecat|legacy"
```

Expect `0`. Any remainder is a real finding — report what it is rather than suppressing it.

- [ ] **Step 3: Run the full browser matrix again**

92 handlers were touched. Every interactive element in the app is in scope.

- [ ] **Step 4: Commit**

```bash
git add client/src
git commit -m "refactor: use Svelte 5 event attribute syntax"
```

---

## Appendix: the browser verification matrix

Run this after Tasks 1, 4, 5, 6 and 7. There are no automated client tests; this is the safety net.

**Setup** — the API needs MongoDB, so boot an in-memory one. Port 5000 is taken by macOS AirPlay Receiver; use 5055.

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
await db.theaters.insertMany([0,1,2].map(i => ({
  eventName: ["Movie Night","Sci-Fi Fest","Noir Evening"][i],
  startTime: new Date(now + 3600000), timeToClose: new Date(now + 10800000),
  amountOfSpaces: 10, position: i, ownerID: "000000000000000000000001",
  usersInsideTheater: [], passwordBool: false, password: "",
  imdbID: "tt000000"+i, movieName: ["The Matrix","Blade Runner","Chinatown"][i],
  movieRuntime: 136, movieReleaseYear: "1999", imdbRating: "8.7",
  hrefPoster: "", moviePlot: "", movieGenres: "Action",
})));
server.listen(5055, () => console.log("READY"));
EOF
node devserver.mjs &
cd ../client && API_URL=http://localhost:5055 npm run build && npx sirv public --no-clear --single --dev --port 8123 &
```

**Use `--dev` on sirv.** Without it a stale or half-written bundle gets served; a truncated one presents as `Unexpected end of input` and a blank page, which looks exactly like a code bug. If you see that, compare `curl -s localhost:8123/build/bundle.js | wc -c` against `wc -c < public/build/bundle.js` before debugging anything.

| # | Check | Covers |
|---|---|---|
| 1 | App loads at `/`, scene renders | mount, App, InteractiveSpace |
| 2 | Stage fills edge-to-edge at 1500×800, 2000×800 and 2560×1320 | `stageLayout` reactivity, Phase 0.4 |
| 3 | Sign up a new user | LoginScreen state + forms |
| 4 | Log in; log in with a wrong password shows a toast | LoginScreen, toast |
| 5 | WASD drives; world scrolls at the edges | InteractiveSpace hot path |
| 6 | Park at a theater → info panel opens; leave → closes | `insideTheaterBool`, TheaterInfoScreen |
| 7 | Join a theater → `/theaters/:id` renders, countdown ticks | router, InsideTheater |
| 8 | Send a chat message; it appears and the list scrolls | `messages` |
| 9 | Leave the theater → back to the scene | navigation |
| 10 | Create Event: search a movie, select, submit | CreateEventScreen |
| 11 | Sort controls in the list view all work | TheatersListView |
| 12 | About panel opens and closes | AboutPage |
| 13 | `/?position=1` teleports to slot 1 | `$location`, teleport |
| 14 | Two browsers see each other's cars move | socket → `cars` |

**Teardown:** `pkill -f "sirv public"; pkill -f devserver.mjs; rm -f server/devserver.mjs`

---

## Done criteria

- `svelte@^5.56.8` installed; `main.js` uses `mount()`.
- No `export let` and no `$:` remain in `client/src`.
- `npm run build` emits zero deprecation or legacy warnings.
- Every matrix row passes.
- The server suite is still 75/75, and CI is green.

## Not in this plan

Phase 0.6 (SvelteKit, which brings Vite 8 and `adapter-vercel`). The `window.location.href` full-page navigations in `InsideTheater.svelte` stay as they are. Defect C7 (`Math.random()` in a class expression, re-randomising the neon colour every render) is carried across unchanged and belongs to Phase 2.
