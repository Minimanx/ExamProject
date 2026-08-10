# Phase 0.3 — Extract the Pixel-Art SVG Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the inline pixel-art SVG out of `InteractiveSpace.svelte` into focused components under `client/src/art/`, so the Svelte 5 runes migration in Phase 0.5 operates on a file of readable size.

**Architecture:** Pure presentational extraction. Each art component owns one drawing, takes only the props it genuinely varies on, and holds no application state. `InteractiveSpace.svelte` keeps all logic, layout and styles; it loses only markup. The player car and remote cars currently duplicate byte-identical path data — they collapse into one component.

**Tech Stack:** Svelte 3 (unchanged — the runes migration is Phase 0.5), Rollup 2 (unchanged — Vite is Phase 0.4).

## Global Constraints

- **Nothing but markup moves.** No behaviour change, no logic change, no style change, no prop renames beyond what extraction requires. Phase 0.4 and 0.5 do the framework work; this task must not pre-empt either.
- **Do not touch `<script>` (lines 1–318) or `<style>` (lines 875–1086)** of `InteractiveSpace.svelte`, except to add `import` statements and to delete CSS rules that are provably orphaned by the move (see Task 7).
- **Do not touch anything under `server/`.** The 75-test server suite is unrelated and must stay green.
- **The path-data invariant is the safety net.** There are no client tests yet (Phase 1 adds them). Every task therefore verifies that the multiset of `d="…"` attribute values across the page plus its art components is unchanged, except for the one deliberate car de-duplication in Task 4. This is what catches a truncated or corrupted 46 KB copy-paste.
- Target file after extraction: **569 lines** (from 1,086) — measured after Tasks 1–7. The initial estimate of ~626 assumed only markup would move; the orphaned CSS moved too. Path data is 62% of the file by bytes but only 44% by lines — the remainder is the script block Phase 0.5 will migrate.
- **Every line number in this plan refers to the ORIGINAL 1,086-line file.** They stop being accurate the moment Task 1 lands. From Task 2 onward, locate each block by its distinguishing attribute — `viewBox`, `class`, or the surrounding `{#each}` — and use the line numbers only as a rough guide to where in the file to look. A task that blindly deletes a stale line range will destroy unrelated markup.
- All client commands run from `client/`.

---

## Baseline: capture this before Task 1

```bash
cd client
grep -o 'd="[^"]*"' src/pages/InteractiveSpace.svelte | sort > /tmp/paths-baseline.txt
wc -l /tmp/paths-baseline.txt src/pages/InteractiveSpace.svelte
```

Record both numbers in your first report. Every later task compares against `/tmp/paths-baseline.txt`.

The comparison command used throughout, which accounts for the car de-duplication once Task 4 lands:

```bash
cd client
cat src/pages/InteractiveSpace.svelte src/art/*.svelte 2>/dev/null | grep -o 'd="[^"]*"' | sort > /tmp/paths-now.txt
diff /tmp/paths-baseline.txt /tmp/paths-now.txt
```

Before Task 4 this diff must be **empty**. After Task 4 it must show exactly the removed duplicate car paths and nothing else.

---

## File Structure

**Created — `client/src/art/`:**

| Component | Source lines | Props | Notes |
|---|---|---|---|
| `Skyline.svelte` | 330–486 | none | Pure static. 157 lines, the single biggest block |
| `Car.svelte` | 498–530 & 787–819 | `name`, `color`, `facingLeft` | Both call sites share byte-identical path data |
| `TheaterFront.svelte` | 535–661 | `theater`, `currentTime` | Contains a nested icon SVG at 642–661 |
| `EmptyLot.svelte` | 665–750 | none | Only the wrapper's `left` offset varies; that stays on the caller |
| `StreetSign.svelte` | 753–780 | none | Pure static |
| `LogoutIcon.svelte` | 835–845 | none | Pure static |

**Modified:** `client/src/pages/InteractiveSpace.svelte` — imports added, six markup blocks replaced by component tags.

---

## Task 1: Extract the skyline

The largest block and the simplest — no dynamic content at all. Doing it first proves the pattern and the verification harness before anything harder.

**Files:**
- Create: `client/src/art/Skyline.svelte`
- Modify: `client/src/pages/InteractiveSpace.svelte`

**Interfaces:**
- Consumes: nothing.
- Produces: `client/src/art/Skyline.svelte`, a default-exported Svelte component taking **no props** and rendering a single `<svg class="backgroundimg" viewBox="0 -0.5 400 140">`.

- [ ] **Step 1: Capture the baseline**

Run the baseline commands above. Record the line counts **and the current commit SHA** (`git rev-parse HEAD`) — Task 6 needs it to build a pre-extraction comparison.

- [ ] **Step 2: Create the component**

Create `client/src/art/Skyline.svelte` containing exactly lines 330–486 of `InteractiveSpace.svelte` — the `<svg class="backgroundimg" …>` element and everything through its closing `</svg>`. Copy the path data verbatim; do not reformat, re-indent, or "tidy" it.

The `class="backgroundimg"` attribute moves with the element. Its CSS rule stays in `InteractiveSpace.svelte`'s style block for now — Svelte 3 scopes styles per component, so this rule will no longer apply. **That is expected and Task 7 resolves it. Do not move CSS in this task.**

- [ ] **Step 3: Replace the block in the page**

In `InteractiveSpace.svelte`, delete lines 330–486 and put in their place:

```svelte
      <Skyline />
```

Add the import at the end of the existing import list in the `<script>` block:

```javascript
  import Skyline from "../art/Skyline.svelte";
```

- [ ] **Step 4: Verify the path-data invariant**

```bash
cd client
cat src/pages/InteractiveSpace.svelte src/art/*.svelte | grep -o 'd="[^"]*"' | sort > /tmp/paths-now.txt
diff /tmp/paths-baseline.txt /tmp/paths-now.txt && echo "INVARIANT HOLDS"
```

Expected: `INVARIANT HOLDS`. Any output from `diff` means path data was altered — stop and report rather than adjusting.

- [ ] **Step 5: Verify the build**

```bash
cd client && API_URL=http://localhost:5000 npm run build
```

Expected: completes, no warnings that were not present before. Record the exact output.

- [ ] **Step 6: Commit**

```bash
git add client/src/art/Skyline.svelte client/src/pages/InteractiveSpace.svelte
git commit -m "refactor: extract the skyline into an art component"
```

---

## Task 2: Extract the street sign and logout icon

Two more pure-static blocks, batched because each is tiny and neither carries props.

**Files:**
- Create: `client/src/art/StreetSign.svelte`, `client/src/art/LogoutIcon.svelte`
- Modify: `client/src/pages/InteractiveSpace.svelte`

**Interfaces:**
- Consumes: the pattern established in Task 1.
- Produces: two prop-less components. `StreetSign.svelte` renders `<svg class="streetSign" viewBox="0 -0.5 28 17">`; `LogoutIcon.svelte` renders the `viewBox="0 -0.5 19 23"` icon that sits inside the logout `<button>`.

- [ ] **Step 1: Extract the street sign**

Create `client/src/art/StreetSign.svelte` with the `<svg class="streetSign" …>` element (originally lines 753–780), verbatim. Replace it in the page with `<StreetSign />` and add the import.

- [ ] **Step 2: Extract the logout icon**

Create `client/src/art/LogoutIcon.svelte` with the `viewBox="0 -0.5 19 23"` SVG (originally lines 835–845), verbatim. It lives inside a `<button class="menuButton" id="logoutButton" on:click={logout}>` — **leave the button, its class, its id and its handler in the page.** Only the `<svg>` moves. Replace with `<LogoutIcon />` and add the import.

- [ ] **Step 3: Verify the invariant and the build**

Run the comparison command and the build, exactly as in Task 1 Steps 4–5. Expected: `INVARIANT HOLDS`, build clean.

- [ ] **Step 4: Commit**

```bash
git add client/src/art client/src/pages/InteractiveSpace.svelte
git commit -m "refactor: extract the street sign and logout icon"
```

---

## Task 3: Extract the empty lot

Nearly static — a single dynamic value, and it belongs to the wrapper rather than the art.

**Files:**
- Create: `client/src/art/EmptyLot.svelte`
- Modify: `client/src/pages/InteractiveSpace.svelte`

**Interfaces:**
- Consumes: the Task 1 pattern.
- Produces: `EmptyLot.svelte`, taking **no props**. The caller keeps responsibility for positioning.

- [ ] **Step 1: Read the block and identify the one dynamic attribute**

Lines 665–750. The `<svg>` opening tag carries a `style` attribute containing `left: {index * 400}px`, where `index` comes from the surrounding `{#each Array(highestPosition) as _, index (index)}`.

Keep that positioning on the caller — the art must not know about world coordinates. Wrap the component in the page instead:

```svelte
          <div class="lotSlot" style="left: {index * 400}px;">
            <EmptyLot />
          </div>
```

…and add to `InteractiveSpace.svelte`'s style block:

```css
  .lotSlot {
    position: absolute;
    bottom: 0;
    width: 401px;
  }
```

This is the one place the plan permits adding CSS, because the positioning has to live somewhere and it cannot live inside the scoped child.

- [ ] **Step 2: Create the component**

Create `client/src/art/EmptyLot.svelte` with the SVG element from lines 665–750, verbatim, **minus** the `left`, `bottom`, `width` and `position` declarations now handled by `.lotSlot`. Keep the `viewBox` and every `<path>` exactly as-is.

- [ ] **Step 3: Verify the invariant and the build**

As in Task 1 Steps 4–5. Expected: `INVARIANT HOLDS`, build clean.

- [ ] **Step 4: Commit**

```bash
git add client/src/art/EmptyLot.svelte client/src/pages/InteractiveSpace.svelte
git commit -m "refactor: extract the empty lot into an art component"
```

---

## Task 4: Extract the car, de-duplicating both call sites

The one task that removes code rather than moving it. The remote-car block (498–530) and the player-car block (787–819) contain **byte-identical path data** — verified by md5 of their extracted `d` attributes. They differ only in which variables feed the name, colour and facing direction.

**Files:**
- Create: `client/src/art/Car.svelte`
- Modify: `client/src/pages/InteractiveSpace.svelte`

**Interfaces:**
- Consumes: the Task 1 pattern.
- Produces: `Car.svelte` with exactly three props:
  - `name: string` — rendered in the `<text class="carName">` element
  - `color: string` — the `stroke` of the car-body `<path>`
  - `facingLeft: boolean` — when `false`, the component applies `transform="scale(-1, 1)"` to the `<svg>` and a counter-transform to the `<text>` so the name is not mirrored

- [ ] **Step 1: Confirm the duplication before relying on it**

```bash
cd client/src/pages
sed -n '498,530p' InteractiveSpace.svelte | grep -o 'd="[^"]*"' | md5
sed -n '787,819p' InteractiveSpace.svelte | grep -o 'd="[^"]*"' | md5
```

Both must print the same hash. If they do not, the blocks have diverged — stop and report; the de-duplication premise is wrong and the task needs rethinking.

- [ ] **Step 2: Create the component**

Create `client/src/art/Car.svelte`:

```svelte
<script>
  export let name = "";
  export let color = "";
  export let facingLeft = false;
</script>

<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 -0.5 48 18"
  shape-rendering="crispEdges"
  preserveAspectRatio="xMaxYMax meet"
  transform={facingLeft === false ? "scale(-1, 1)" : ""}
>
  <text
    class="carName"
    transform={facingLeft === false ? "scale(-1, 1)" : ""}
    transform-origin={facingLeft === false ? "50% 50%" : ""}
    font-size="10px"
    font-weight="bold">{name}</text
  >
  <!-- paste every <path> element from the remote-car block here, verbatim -->
</svg>
```

Copy every `<path>` element from the **remote car** block exactly — six of them: the `#000000` outline, the body path (whose `stroke` becomes `{color}`), `#613c0c`, `#333333`, `#7a7a7a` and `#ababab`. Confirm the count before and after:

```bash
cd client
sed -n '/class="remoteCar"/,/<\/svg>/p' src/pages/InteractiveSpace.svelte | grep -c '<path'
grep -c '<path' src/art/Car.svelte
```

Both must print `6`.

`carName` is styled by a rule in the page's style block. As with Task 1, that rule stops applying once the element is in a child component — Task 7 resolves it. Do not move CSS here.

- [ ] **Step 3: Replace both call sites**

The remote-car call site, inside `{#each cars as car (car.id)}`:

```svelte
          <div
            class="remoteCar"
            style="transform: translate3d({car.coords.x}px, {car.coords.y}px, 0);"
          >
            <Car name={car.name} color={car.color} facingLeft={car.coords.direction} />
          </div>
```

The player-car call site:

```svelte
            <Car name={playerName} color={$user.playerColor} facingLeft={playerDirection} />
```

Keep both wrapper `<div>`s, their classes and their inline `transform` styles in the page — those are positioning, not art.

**Check the original prop sources before wiring these up.** The remote car reads `car.coords.direction`, `car.name` and `car.color`; the player car reads `playerDirection`, `playerName` and `$user.playerColor`. Confirm against the file rather than trusting this plan, and report any mismatch.

- [ ] **Step 4: Verify the invariant — this is the one task where the diff is not empty**

```bash
cd client
cat src/pages/InteractiveSpace.svelte src/art/*.svelte | grep -o 'd="[^"]*"' | sort > /tmp/paths-now.txt
diff /tmp/paths-baseline.txt /tmp/paths-now.txt
```

Expected: output showing **only** removed lines, all of them car paths, each appearing once fewer than before. Nothing added, nothing else removed. Paste the full diff into your report.

Then confirm the surviving car paths are complete:

```bash
cd client && grep -c 'd="' src/art/Car.svelte
```

- [ ] **Step 5: Verify the build**

```bash
cd client && API_URL=http://localhost:5000 npm run build
```

- [ ] **Step 6: Commit**

```bash
git add client/src/art/Car.svelte client/src/pages/InteractiveSpace.svelte
git commit -m "refactor: extract the car and de-duplicate the player/remote copies"
```

---

## Task 5: Extract the theater front

The most involved block: 127 lines with twelve carrying dynamic content, plus a nested icon SVG.

**Files:**
- Create: `client/src/art/TheaterFront.svelte`
- Modify: `client/src/pages/InteractiveSpace.svelte`

**Interfaces:**
- Consumes: the Task 1 pattern.
- Produces: `TheaterFront.svelte` with two props:
  - `theater: object` — the theater document, read for `eventName`, `startTime`, `timeToClose`, `movieName`/`movieNameCutToFit`, `imdbRating`, `hrefPoster` and `amountOfSpaces`/`usersInsideTheater`
  - `currentTime: Date` — passed in rather than read from a store, so the component stays presentational and the page keeps owning the clock

- [ ] **Step 1: Read the block and inventory what it reads**

Lines 535–661. Before writing anything, list every `theater.*` field and every other outside value the block references, and put that list in your report. The plan's list above is a starting point, not an authority — verify it.

Note the `{'neoncolor' + Math.floor(Math.random() * 5)}` expression on the movie title. **Move it verbatim.** It re-randomises on every reactive update, which is roadmap defect C7 — it is not this task's job to fix it, and changing it here would make the extraction impossible to verify as behaviour-preserving.

- [ ] **Step 2: Create the component**

Create `client/src/art/TheaterFront.svelte` with `export let theater;` and `export let currentTime;`, then the SVG element from 535–661 verbatim, including the nested `viewBox="0 0 640 512"` icon at 642–661.

Remove only the `left: {theater.position * 400}px` positioning from the wrapper's `style`, as in Task 3, and hoist it into a wrapper `<div class="lotSlot">` at the call site — reusing the class Task 3 added.

- [ ] **Step 3: Replace the call site**

Inside `{#each theaters as theater (theater._id)}`:

```svelte
          <div class="lotSlot" style="left: {theater.position * 400}px;">
            <TheaterFront {theater} {currentTime} />
          </div>
```

- [ ] **Step 4: Verify the invariant and the build**

As in Task 1 Steps 4–5, expecting the same diff as after Task 4 — the car de-duplication and nothing further. Expected build: clean.

- [ ] **Step 5: Commit**

```bash
git add client/src/art/TheaterFront.svelte client/src/pages/InteractiveSpace.svelte
git commit -m "refactor: extract the theater front into an art component"
```

---

## Task 6: Verify the whole extraction visually

The path-data invariant proves no art was corrupted. It cannot prove the page still *looks* right — scoped-style breakage in particular is invisible to it.

**Files:** none changed unless a defect is found.

- [ ] **Step 1: Build and serve**

```bash
cd client && API_URL=http://localhost:5000 npm run build && npm start
```

- [ ] **Step 2: Compare against the pre-extraction rendering**

`git stash` is not appropriate here — the work is committed. Instead build the parent of this branch's first extraction commit into a separate directory and serve both:

Use the commit you recorded in Task 1 Step 1 as the baseline — it is the parent of the first extraction commit, obtainable with `git log --oneline --all | grep "extract the skyline"` and then `<sha>^`:

```bash
BASE=$(git rev-parse "$(git log --format=%H --grep='extract the skyline' -1)^")
git worktree add /tmp/pre-extraction "$BASE"
cd /tmp/pre-extraction/client && npm install && API_URL=http://localhost:5000 npm run build
```

Serve each in turn and compare: the skyline, a theater front, an empty lot, the street sign, the player car, a remote car, and the logout button. Report anything that differs — position, colour, size, mirroring, or text placement.

Remove the comparison worktree when done: `git worktree remove /tmp/pre-extraction`.

- [ ] **Step 3: Report**

List each of the seven elements and whether it renders identically. Any difference is a finding, not something to fix silently.

---

## Task 7: Rehome the orphaned CSS

Svelte 3 scopes styles to the component that declares them. Every rule in `InteractiveSpace.svelte`'s style block that targets an element now living in `client/src/art/` stopped applying the moment that element moved — silently, with no build warning.

**Files:**
- Modify: `client/src/pages/InteractiveSpace.svelte`, and the art components that need the rules

**Interfaces:**
- Consumes: all six components from Tasks 1–5.
- Produces: no orphaned selectors in the page's style block.

- [ ] **Step 1: Find the orphaned rules**

For every selector in the page's style block (lines 875–1086 pre-extraction), determine whether any element carrying it still lives in `InteractiveSpace.svelte`. Known candidates from the earlier tasks: `.backgroundimg`, `.carName`, `.streetSign`, `.movieTitle`, `.eventInfo`, `.startTime`, `.closing`, `.closed`, and the `.neoncolor0`–`.neoncolor4` set.

Produce the list before changing anything, and put it in your report.

- [ ] **Step 2: Move each orphaned rule into the component that owns its element**

Move, do not copy — a duplicated rule is a future divergence. Keep declarations byte-identical.

Two cases need care:
- **`.neoncolor0`–`.neoncolor4`** are applied via a computed class string in `TheaterFront.svelte`. Svelte 3's CSS pruning cannot see a dynamically built class name and will strip the rules as unused. Wrap each in `:global(...)` inside `TheaterFront.svelte` — e.g. `:global(.neoncolor0) { … }`. That is the mechanism Svelte 3 provides for classes it cannot statically prove are used. Verify with the `bundle.css` grep in Step 3 rather than by eye.
- **`.carName`** is inside `Car.svelte`, which renders inside an SVG. Confirm the rule still matches after the move.

- [ ] **Step 3: Verify every moved rule survives into the bundle**

```bash
cd client && API_URL=http://localhost:5000 npm run build
for sel in backgroundimg carName streetSign movieTitle eventInfo neoncolor; do
  printf "%-16s %s\n" "$sel" "$(grep -c "$sel" public/build/bundle.css)"
done
```

Every count must be non-zero. A zero means Svelte pruned the rule as unused and the styling is gone.

- [ ] **Step 4: Re-run the visual comparison from Task 6**

Styling regressions are exactly what this task risks. Repeat Task 6 Step 2 and report.

- [ ] **Step 5: Commit**

```bash
git add client/src
git commit -m "refactor: rehome CSS orphaned by the art extraction"
```

---

## Task 8: Correct the roadmap's own numbers

The roadmap spec claimed `InteractiveSpace.svelte` was "1,086 lines of which roughly 85% is
inline SVG path data" and that extraction would take it to "~250 lines". Both figures were
wrong, in opposite directions.

**Measured:** the inline SVG is **62% of the file by bytes but only 44% by lines** (475 of
1,086) — the byte figure was mistaken for a line figure, which is where ~250 came from.
Markup extraction alone would have left ~626 lines. The actual result is **569**, because
Task 7 moved the orphaned CSS out as well.

- [ ] **Step 1: Correct both documents**

In `docs/superpowers/specs/2026-08-09-flixdrive-roadmap-design.md` and `docs/superpowers/plans/2026-08-09-phase0-server-upgrades.md`, replace the 85%/250-line claims with the measured figures. State the byte/line distinction explicitly — it is the reason the original estimate was wrong.

- [ ] **Step 2: Record the actual outcome**

Add the real final line count of `InteractiveSpace.svelte` once Tasks 1–7 are done.

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers
git commit -m "docs: correct the SVG-extraction size estimates with measured figures"
```

---

## Done criteria

- `client/src/art/` contains six components; none imports application state.
- `InteractiveSpace.svelte` is roughly 626 lines, with its `<script>` block untouched.
- The path-data diff against the baseline shows only the Task 4 car de-duplication.
- `npm run build` is clean and CI's Client build job is green.
- Every previously-styled element still renders identically (Tasks 6 and 7).
- The server suite is still 75/75 — this phase must not have touched it.

## Not in this plan

Phase 0.4 (Vite + throwaway router), 0.5 (Svelte 5 runes) and 0.6 (SvelteKit) follow separately. Defect C7 (`Math.random()` re-randomising the neon colour on every render) is deliberately carried across unchanged; fixing it belongs to Phase 2 alongside the other correctness work.
