# Phase 0.6 — Rollup → SvelteKit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hand-rolled Rollup build with SvelteKit, which brings Vite 8, file-based routing, and a maintained toolchain — completing Phase 0.

**Architecture:** SvelteKit owns bootstrapping, routing and the build. `App.svelte` becomes `+layout.svelte`, the two routes become `+page.svelte` files, `public/` becomes `static/`, and the in-repo router from Phase 0.4 is deleted. No application logic changes.

**Tech Stack:** `@sveltejs/kit@2.70.2`, `@sveltejs/vite-plugin-svelte@7.3.0`, `vite@8.2.1`, `svelte@5.56.8`.

## Global Constraints

- **No behaviour changes.** Same URLs, same guard, same UI. The 21-test e2e suite is the gate and must stay green.
- **Do not touch anything under `server/`.** The 75-test suite must stay green.
- Rollup and all its plugins are removed at the end, not partway.

## Deviation from the roadmap: adapter-static, not adapter-vercel

The roadmap named `adapter-vercel`, on the reasoning that SvelteKit's SSR would serve future marketing and club pages. That reasoning still holds — but **not one route can server-render today**:

- `InteractiveSpace.svelte` and `InsideTheater.svelte` both call `createSocket()` at component-init scope. Under SSR that opens a socket.io client on the server.
- `userStore.js` reads `localStorage` at module scope.
- The world route touches `window` directly.

Those are the only two routes, so SSR is off everywhere regardless of adapter. `adapter-vercel` would then deploy serverless functions that render nothing server-side — strictly worse than the static hosting in place now.

`adapter-static` with a SPA fallback reproduces the current deployment exactly: static files plus a catch-all rewrite. Swapping to `adapter-vercel` is a one-line change the day a route actually wants SSR, which is Phase 5's club pages. Record that in the roadmap.

---

## Task 1: Scaffold SvelteKit alongside the existing build

**Files:** `client/package.json`, `client/svelte.config.js`, `client/vite.config.js`, `client/src/app.html`, `client/static/`

- [ ] **Step 1: Install**

```bash
cd client
npm install --save-dev @sveltejs/kit@^2.70.2 @sveltejs/adapter-static@^3.0.10 \
  @sveltejs/vite-plugin-svelte@^7.3.0 vite@^8.2.1
```

- [ ] **Step 2: `svelte.config.js`**

```javascript
import adapter from "@sveltejs/adapter-static";

export default {
    kit: {
        // SPA fallback: every path serves the same shell and the client router
        // takes over, which is exactly what the Rollup + sirv --single setup did.
        adapter: adapter({ fallback: "index.html", strict: false }),
    },
};
```

- [ ] **Step 3: `vite.config.js`**

```javascript
import { sveltekit } from "@sveltejs/kit/vite";

export default { plugins: [sveltekit()] };
```

- [ ] **Step 4: `src/app.html` from `public/index.html`**

Keep the title, favicon and `global.css` link. Replace the hand-written bundle tags with SvelteKit's placeholders:

```html
<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset='utf-8'>
	<meta name='viewport' content='width=device-width,initial-scale=1'>
	<title>Flix Drive</title>
	<link rel='icon' type='image/png' href='%sveltekit.assets%/favicon.png'>
	<link rel='stylesheet' href='%sveltekit.assets%/global.css'>
	%sveltekit.head%
</head>
<body>
	<div style="display: contents">%sveltekit.body%</div>
</body>
</html>
```

- [ ] **Step 5: `public/` → `static/`**

```bash
cd client && git mv public/favicon.png public/global.css public/water-tile.svg static/ 2>/dev/null || (mkdir -p static && git mv public/favicon.png public/global.css public/water-tile.svg static/)
git rm public/index.html
```

`public/build/` is generated and gitignored; delete it.

---

## Task 2: Move to file-based routing

**Files:** `client/src/routes/**`, deleting `client/src/App.svelte`, `client/src/main.js`, `client/src/lib/router.js`

- [ ] **Step 1: `src/routes/+layout.js`**

```javascript
// Not one route can server-render: both pages open a socket at component-init
// scope and userStore reads localStorage at module scope. SSR is disabled
// app-wide until a route exists that can support it.
export const ssr = false;
export const prerender = false;
```

- [ ] **Step 2: `src/routes/+layout.svelte` from `App.svelte`**

Keep the stage sizing logic, the `<main>` element with its CSS custom properties, and the `<style>` block verbatim. Replace the `{#if $route…}` branch with `{@render children()}`:

```svelte
<script>
	import { onMount } from "svelte";
	import { SvelteToast } from "@zerodevx/svelte-toast";

	let { children } = $props();
	// …stage sizing unchanged…
</script>

<div class="toasts"><SvelteToast options={{ intro: { y: -500 } }} /></div>

<main style="…unchanged…">{@render children()}</main>
```

- [ ] **Step 3: `src/routes/+page.svelte`**

```svelte
<script>
	import InteractiveSpace from "$lib/pages/InteractiveSpace.svelte";
</script>

<InteractiveSpace />
```

- [ ] **Step 4: `src/routes/theaters/[id]/+page.svelte`**

The old router guarded this route on `$user.loggedIn` and fell through to the world otherwise. Preserve that exactly:

```svelte
<script>
	import { page } from "$app/state";
	import { user } from "$lib/stores/userStore.js";
	import InsideTheater from "$lib/pages/InsideTheater.svelte";
	import InteractiveSpace from "$lib/pages/InteractiveSpace.svelte";
</script>

{#if $user.loggedIn === true}
	<InsideTheater id={page.params.id} />
{:else}
	<InteractiveSpace />
{/if}
```

- [ ] **Step 5: Move everything else under `src/lib/`**

SvelteKit reserves `src/routes`; shared code belongs in `src/lib` and is reachable via the `$lib` alias. Move `art/`, `components/`, `pages/`, `services/`, `stores/` there and update every import.

- [ ] **Step 6: Delete the old entry points**

`src/App.svelte`, `src/main.js` and `src/lib/router.js` all go. Replace the router's two consumers:

- `TheaterInfoScreen.svelte`: `navigate(...)` → `goto(...)` from `$app/navigation`
- `InteractiveSpace.svelte`: `$location.search` → `page.url.searchParams` from `$app/state`

---

## Task 3: Environment and SSR guards

**Files:** `client/src/lib/services/api.js`, `client/src/lib/stores/userStore.js`, `client/.env.example`

- [ ] **Step 1: `PUBLIC_API_URL`**

`process.env.API_URL` was injected by `@rollup/plugin-replace`. SvelteKit exposes only `PUBLIC_`-prefixed variables to the client:

```javascript
import { PUBLIC_API_URL } from "$env/static/public";

export const apiUrl = (PUBLIC_API_URL || "").replace(/\/$/, "");
```

Update `client/.env.example` and every place that sets `API_URL` — the CI workflow, the Playwright config, and `DEPLOYMENT.md`.

- [ ] **Step 2: Guard `localStorage`**

`userStore.js` reads it at module scope. Even with `ssr = false` the module is analysed during build, so guard it:

```javascript
import { browser } from "$app/environment";

const stored = browser ? localStorage.getItem("user") : null;
export const user = writable(stored ? JSON.parse(stored) : { loggedIn: false });
if (browser) user.subscribe((v) => localStorage.setItem("user", JSON.stringify(v)));
```

---

## Task 4: Rewire the build, the tests and CI

**Files:** `client/package.json`, `client/playwright.config.js`, `.github/workflows/ci.yml`, `client/vercel.json`, `DEPLOYMENT.md`

- [ ] **Step 1: Scripts**

```json
"dev": "vite dev",
"build": "vite build",
"preview": "vite preview",
"test:e2e": "playwright test"
```

The e2e suite no longer needs a manual build step in the script: `vite preview` refuses to serve a stale build, and the webServer command can build and preview in one. Keep the build explicit anyway — the Phase 0.5 lesson was that `reuseExistingServer` silently skips it.

- [ ] **Step 2: Playwright serves the SvelteKit build**

Replace the `sirv` command with `npm run build && npm run preview -- --port 8123`, and set `PUBLIC_API_URL` rather than `API_URL`.

- [ ] **Step 3: CI and deployment**

`.github/workflows/ci.yml` sets `API_URL` for the client build — rename to `PUBLIC_API_URL`. `vercel.json`'s `outputDirectory` becomes `build`. Update `DEPLOYMENT.md` for both the variable rename and the output directory.

- [ ] **Step 4: Remove Rollup**

```bash
cd client && npm uninstall rollup rollup-plugin-svelte rollup-plugin-css-only \
  rollup-plugin-livereload @rollup/plugin-commonjs @rollup/plugin-node-resolve \
  @rollup/plugin-replace @rollup/plugin-terser sirv-cli
rm rollup.config.js
```

`sirv-cli` goes too — `vite preview` replaces it.

---

## Done criteria

- `npm run build` produces `client/build/`; no Rollup dependency remains.
- The 21-test e2e suite is green against the SvelteKit build.
- The server suite is still 75/75 and CI is green.
- `src/App.svelte`, `src/main.js`, `src/lib/router.js` and `rollup.config.js` are gone.
- No `process.env` reference survives in `client/src`.
