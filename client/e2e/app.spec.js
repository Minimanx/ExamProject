import { test, expect } from "@playwright/test";

// Characterization tests for the client. Like the server suite, these pin what
// the app does today so a refactor that changes behaviour fails loudly. They
// exist because the Svelte 5 runes migration breaks reactivity SILENTLY: a
// component that enters runes mode stops re-rendering plain `let`s with no
// error and no build warning. Only exercising the UI catches that.
//
// The suite drives one shared world, so it runs serially in file order.

// Unique per run: the dev server is reused between runs (reuseExistingServer),
// so a fixed address would collide with the previous run's user on the second
// invocation and signup would return "Email already exists".
const RUN = Date.now().toString(36).slice(-6);
const API = "http://localhost:5055";

// The account every test logs in with. Created once through the API rather
// than by an earlier test, so no test depends on another having run — a
// focused run (`-g`) works exactly like a full one.
const USER = {
    email: `e2e-${RUN}@example.com`,
    username: `e2e${RUN}`,
    password: "password123",
};

// A second player for the two-context socket test.
const MOVER = {
    email: `mover-${RUN}@example.com`,
    username: `mover${RUN}`,
    password: "password123",
};

// A separate account for the UI signup test, so it never collides with USER.
const SIGNUP_USER = {
    email: `signup-${RUN}@example.com`,
    username: `signup${RUN}`,
    password: "password123",
};

test.describe.configure({ mode: "serial" });

// loginLimiter allows 10 requests per 15 minutes per IP, and nearly every test
// logs in. From one browser they all share 127.0.0.1, so the suite silently
// accumulates toward the cap and starts failing at login as it grows. The app
// sets `trust proxy`, so a distinct X-Forwarded-For per test gives each its own
// bucket — the same fix the server suite needed for exactly the same reason.
let ipCounter = 0;
test.beforeEach(async ({ page }) => {
    ipCounter += 1;
    await page.setExtraHTTPHeaders({
        "X-Forwarded-For": `10.1.${Math.floor(ipCounter / 256) % 256}.${ipCounter % 256}`,
    });
});

test.beforeAll(async ({ request }) => {
    for (const account of [USER, MOVER]) {
        await request.post(`${API}/users`, {
            data: { ...account, passwordRepeat: account.password },
            failOnStatusCode: false,
        });
    }
});

/** The login overlay covers the scene until a user is stored. */
async function signUp(page) {
    await page.goto("/");
    await page.getByRole("button", { name: "Sign Up" }).click();
    await page.locator('input[name="email"]').fill(SIGNUP_USER.email);
    await page.locator('input[name="username"]').fill(SIGNUP_USER.username);
    await page.locator('input[name="password"]').fill(SIGNUP_USER.password);
    await page.locator('input[name="passwordRepeat"]').fill(SIGNUP_USER.password);
    await page.getByRole("button", { name: "Create Account" }).click();
}

async function logIn(page) {
    await page.goto("/");
    await page.locator('input[name="email"]').fill(USER.email);
    await page.locator('input[name="password"]').fill(USER.password);
    await page.getByRole("button", { name: "Login" }).click();
    await expect(page.locator(".blackedout")).toHaveCount(0);
}

test("the scene renders with the seeded theaters", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".containerInteractiveSpace")).toBeVisible();
    await expect(page.locator(".lotSlot")).toHaveCount(3);
    await expect(page.locator(".containerListView")).toContainText("Movie Night");
});

// Phase 0.4: the stage was scaled to fit but only grown vertically, so any
// viewport wider than 1500/800 = 1.875:1 got black bars.
for (const [w, h, label] of [
    [1500, 800, "design size"],
    [2000, 800, "wide"],
    [2560, 1320, "27in with browser chrome"],
    [3440, 1400, "ultrawide"],
]) {
    test(`the stage fills the viewport edge to edge — ${label}`, async ({ page }) => {
        await page.setViewportSize({ width: w, height: h });
        await page.goto("/");
        await expect(page.locator(".containerInteractiveSpace")).toBeVisible();

        const gaps = await page.evaluate(() => {
            const r = document.querySelector("main").getBoundingClientRect();
            return {
                side: (window.innerWidth - r.width) / 2,
                topBottom: (window.innerHeight - r.height) / 2,
            };
        });
        expect(gaps.side).toBeLessThan(1);
        expect(gaps.topBottom).toBeLessThan(1);
    });
}

// The viewport tests above each load fresh at their size, so the initial
// stageLayout value alone satisfies them. Resizing an already-loaded page is
// the path that needs stageLayout to stay reactive — the one that breaks if it
// is not $state after the runes conversion.
test("the stage re-fits when an already-loaded page is resized", async ({ page }) => {
    await page.setViewportSize({ width: 1500, height: 800 });
    await page.goto("/");
    await expect(page.locator(".containerInteractiveSpace")).toBeVisible();

    const widthAt = async () =>
        page.evaluate(() => document.querySelector("main").getBoundingClientRect().width);

    expect(await widthAt()).toBeCloseTo(1500, 0);

    await page.setViewportSize({ width: 2400, height: 900 });
    await expect.poll(widthAt, { timeout: 5000 }).toBeCloseTo(2400, 0);

    await page.setViewportSize({ width: 1800, height: 1000 });
    await expect.poll(widthAt, { timeout: 5000 }).toBeCloseTo(1800, 0);
});

// Phase 0.4: the world is highestPosition * 400px and each slot draws its own
// ground. Widening the scene past the hard-coded 1200px floor ran the ground
// out and showed bare water.
test("the world always spans at least the visible scene", async ({ page }) => {
    await page.setViewportSize({ width: 3440, height: 1400 });
    await page.goto("/");
    await expect(page.locator(".containerInteractiveSpace")).toBeVisible();

    const { world, scene } = await page.evaluate(() => ({
        world: document.querySelector(".world").getBoundingClientRect().width,
        scene: document.querySelector(".containerInteractiveSpace").getBoundingClientRect().width,
    }));
    expect(world).toBeGreaterThanOrEqual(scene);
});

test("signing up creates a user", async ({ page }) => {
    await signUp(page);
    await expect(page.locator("._toastContainer")).toContainText("User created");
});

// Roadmap §3, hedge 1: registration can be closed behind INVITE_ONLY, and an
// invite is redeemed by the link carrying ?invite=CODE rather than by an extra
// field on screen. The server side has its own tests; what they cannot show is
// that the client actually puts the code in the request, so this reads the body
// the browser sends.
test("an invite link puts its code in the signup request", async ({ page }) => {
    let sentBody = null;
    await page.route("**/users", async (route) => {
        sentBody = route.request().postDataJSON();
        await route.fulfill({ status: 200, json: { message: "User created" } });
    });

    await page.goto("/?invite=GOLDENTICKET");
    await page.getByRole("button", { name: "Sign Up" }).click();
    await page.locator('input[name="email"]').fill("invited@example.com");
    await page.locator('input[name="username"]').fill("invitedone");
    await page.locator('input[name="password"]').fill("password123");
    await page.locator('input[name="passwordRepeat"]').fill("password123");
    await page.getByRole("button", { name: "Create Account" }).click();

    await expect.poll(() => sentBody).not.toBeNull();
    expect(sentBody.inviteCode).toBe("GOLDENTICKET");
});

// Nothing extra is sent when there is no invite in the link, so an open
// registration is byte-for-byte what it was.
test("an ordinary visit sends no invite code", async ({ page }) => {
    let sentBody = null;
    await page.route("**/users", async (route) => {
        sentBody = route.request().postDataJSON();
        await route.fulfill({ status: 200, json: { message: "User created" } });
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Sign Up" }).click();
    await page.locator('input[name="email"]').fill("plain@example.com");
    await page.locator('input[name="username"]').fill("plainone");
    await page.locator('input[name="password"]').fill("password123");
    await page.locator('input[name="passwordRepeat"]').fill("password123");
    await page.getByRole("button", { name: "Create Account" }).click();

    await expect.poll(() => sentBody).not.toBeNull();
    expect(sentBody.inviteCode).toBeUndefined();
});

// Doubles as the guard on non-400 failures. The client used to check
// `response.status === 400` and ignore everything else, so when the API started
// answering 401 for bad credentials this test failed with an empty toast — the
// user saw nothing at all. Any regression to status-equality checks lands here.
test("logging in with a wrong password shows an error and keeps the form usable", async ({
    page,
}) => {
    await page.goto("/");
    await page.locator('input[name="email"]').fill(USER.email);
    await page.locator('input[name="password"]').fill("definitely-wrong");
    await page.getByRole("button", { name: "Login" }).click();
    await expect(page.locator("._toastContainer")).toContainText("Email or password incorrect");
    await expect(page.locator(".blackedout")).toHaveCount(1);
});

test("logging in dismisses the overlay", async ({ page }) => {
    await logIn(page);
    await expect(page.locator(".containerInteractiveSpace")).toBeVisible();
});

test("driving moves the player car", async ({ page }) => {
    await logIn(page);
    const car = page.locator(".playerCar");
    const before = await car.getAttribute("style");

    await page.keyboard.down("d");
    await page.waitForTimeout(400);
    await page.keyboard.up("d");
    await page.waitForTimeout(150);

    expect(await car.getAttribute("style")).not.toBe(before);
});

test("parking at a theater opens its info panel, and joining enters the theater", async ({
    page,
}) => {
    await logIn(page);

    // Drive up into the theater row.
    await page.keyboard.down("w");
    await page.waitForTimeout(700);
    await page.keyboard.up("w");

    const join = page.getByRole("button", { name: /^join$/i });
    await expect(join).toBeVisible();
    await join.click();

    await expect(page).toHaveURL(/\/theaters\/[a-f0-9]{24}$/);
    await expect(page.locator(".liveChatContainer")).toBeVisible();
    await expect(page.locator(".timeOfMovie h1").first()).toContainText(
        /Starts in|Ongoing|Closing|Closed/
    );
});

// The countdown is driven by an interval updating currentTime and the derived
// hour/minute/second values. Nothing else exercises that they keep updating.
test("the theater countdown keeps ticking", async ({ page }) => {
    await logIn(page);
    await page.keyboard.down("w");
    await page.waitForTimeout(700);
    await page.keyboard.up("w");
    await page.getByRole("button", { name: /^join$/i }).click();
    await expect(page.locator(".liveChatContainer")).toBeVisible();

    const clock = page.locator(".timeOfMovie h1").last();
    const first = await clock.textContent();
    await expect.poll(async () => clock.textContent(), { timeout: 8000 }).not.toBe(first);
});

test("sending a chat message shows it and clears the input", async ({ page }) => {
    await logIn(page);
    await page.keyboard.down("w");
    await page.waitForTimeout(700);
    await page.keyboard.up("w");
    await page.getByRole("button", { name: /^join$/i }).click();
    await expect(page.locator(".liveChatContainer")).toBeVisible();

    await page.locator(".messageInput").fill("hello from the suite");
    await page.locator(".messageButton").click();

    await expect(page.locator(".liveChat")).toContainText("hello from the suite");
    await expect(page.locator(".messageInput")).toHaveValue("");
});

// TheatersListView sorts the theaters array in place. Its four sort controls
// are the only thing driving its own state, and nothing covered them before it
// was converted — which matters because it sorts a array owned by its parent.
test("the list view sorts by name and reverses on a second click", async ({ page }) => {
    await logIn(page);

    const names = () => page.locator(".containerListView .names").allTextContents();

    const initial = await names();
    expect(initial.length).toBeGreaterThan(1);

    const sortByName = page
        .locator(".containerListView li")
        .filter({ hasText: /^Name\/Movie$/ })
        .first();
    await sortByName.click();
    const ascending = await names();
    expect(ascending).not.toEqual(initial);
    expect([...ascending].sort()).toEqual(ascending);

    await sortByName.click();
    const descending = await names();
    expect(descending).toEqual([...ascending].reverse());
});

test("the about panel opens and closes again", async ({ page }) => {
    await logIn(page);
    await page.getByRole("button", { name: "About" }).click();
    await expect(page.locator(".containerListView")).toContainText(/passion project|semester/i);

    // Closing is driven by the child writing back through a two-way bound prop,
    // which is what $bindable() governs in runes mode.
    await page.getByRole("button", { name: "Back" }).click();
    await expect(page.locator(".containerListView")).not.toContainText(/passion project/i);
    await expect(page.getByRole("button", { name: "About" })).toBeVisible();
});

// CreateEventScreen holds the most state of any component, and none of it was
// covered before the runes migration touched it. OMDB is unreachable with a
// test key, so the movie search is intercepted.
test("creating an event: search, select a movie, and submit", async ({ page }) => {
    await page.route("**/movies?s=*", (route) =>
        route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
                data: {
                    Response: "True",
                    Search: [
                        { Title: "Interstellar", Year: "2014", imdbID: "tt0816692", Poster: "N/A" },
                    ],
                },
            }),
        })
    );

    await logIn(page);
    await page.getByRole("button", { name: "Create Event" }).first().click();

    // Two buttons are labelled "Create Event" and both carry
    // id="addTheaterButton": the one in the scene that opens this panel, and
    // the one inside it that submits. Scope to the panel holding the form.
    // Containers nest, so filtering matches the outer scene container too;
    // document order puts the innermost (the panel) last.
    const panel = page
        .locator("div.container")
        .filter({ has: page.locator('input[name="eventName"]') })
        .last();

    await page.locator('input[name="eventName"]').fill("Runes Night");
    await page.locator('input[name="searchMovie"]').first().fill("interstellar");
    await page.locator('input[name="searchMovie"]').first().dispatchEvent("change");

    // The result list renders once the (intercepted) search resolves. Scope to
    // the panel: an unscoped "ul" also matches the toast container.
    const result = panel.locator("ul").filter({ hasText: "Interstellar" }).first();
    await expect(result).toBeVisible();
    // dispatchEvent rather than click(): the search is debounced and re-renders
    // the result list, which swallows a real mouse click landing mid-render.
    // This exercises the same on:click handler deterministically.
    await result.dispatchEvent("click");
    // Selecting sets chosenMovieID, which the markup reflects as .selectedMovie.
    await expect(result).toHaveClass(/selectedMovie/);

    const soon = new Date(Date.now() + 90 * 60 * 1000);
    const hh = String(soon.getHours()).padStart(2, "0");
    const mm = String(soon.getMinutes()).padStart(2, "0");
    await page.locator('input[name="startTime"]').fill(`${hh}:${mm}`);
    await page.locator('input[name="amountOfSpaces"]').fill("10");

    await panel.getByRole("button", { name: "Create Event" }).click();
    await expect(page.locator("._toastContainer")).toContainText(
        /Event Created|already have an ongoing event/i
    );
});

test("unknown paths fall back to the scene", async ({ page }) => {
    await logIn(page);
    await page.goto("/some/unknown/path");
    await expect(page.locator(".containerInteractiveSpace")).toBeVisible();
    await expect(page.locator(".liveChatContainer")).toHaveCount(0);
});

test("a theater URL falls back to the scene when logged out", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.setItem("user", JSON.stringify({ loggedIn: false })));
    await page.goto("/theaters/000000000000000000000099");
    await expect(page.locator(".containerInteractiveSpace")).toBeVisible();
    await expect(page.locator(".liveChatContainer")).toHaveCount(0);
});

// Phase 0.3: Car.svelte briefly declared `export let facingLeft = false`. A
// prop default fires on `undefined` — and a remote car carries no `direction`
// until it first moves — so every car rendered mirrored the moment it joined.
//
// The player's own direction is explicitly `false` at rest, and `false` means
// "facing right", which mirrors the left-facing base art. So the two cars are
// expected to differ at rest, and that asymmetry is exactly what the bug erased.
// DEFECT C7 (roadmap spec §5): the neon colour class was computed with
// `Math.floor(Math.random() * 5)` inline in the markup. In runes mode that
// expression belongs to the template, so it is re-evaluated on every reactive
// update — and TheaterFront takes `currentTime`, which ticks once a second.
// The marquee changed colour every second on every theater on the strip.
test("a theater's neon marquee colour holds still", async ({ page }) => {
    await logIn(page);

    const marquee = page.locator(".movieTitle").first();
    await expect(marquee).toBeVisible();
    // Must be a real theater, not an empty lot: only TheaterFront takes the
    // ticking `currentTime` prop, so only it can re-render on the interval.
    expect(await marquee.textContent()).not.toBe("Empty");

    const first = await marquee.getAttribute("class");
    await page.waitForTimeout(2500);

    expect(await marquee.getAttribute("class")).toBe(first);
});

test("the player car is mirrored at rest, matching playerDirection === false", async ({ page }) => {
    await logIn(page);
    const transform = await page.locator(".playerCar svg").first().getAttribute("transform");
    expect(transform).toContain("scale(-1, 1)");
});

test("a remote car that has never moved is not mirrored", async ({ browser }) => {
    const watcher = await browser.newContext();
    const mover = await browser.newContext();
    try {
        const watcherPage = await watcher.newPage();
        await watcherPage.goto("/");
        await watcherPage.locator('input[name="email"]').fill(USER.email);
        await watcherPage.locator('input[name="password"]').fill(USER.password);
        await watcherPage.getByRole("button", { name: "Login" }).click();
        await expect(watcherPage.locator(".containerInteractiveSpace")).toBeVisible();

        // A second player joins and never presses a key, so its car has no
        // `direction` at all. It must log in: since defect S4 was fixed, an
        // unauthenticated socket cannot broadcast a car, so anonymous visitors
        // no longer appear in the world.
        const moverPage = await mover.newPage();
        await moverPage.goto("/");
        await moverPage.locator('input[name="email"]').fill(MOVER.email);
        await moverPage.locator('input[name="password"]').fill(MOVER.password);
        await moverPage.getByRole("button", { name: "Login" }).click();
        await expect(moverPage.locator(".containerInteractiveSpace")).toBeVisible();

        const remoteCar = watcherPage.locator(".remoteCar svg").first();
        await expect(remoteCar).toBeVisible({ timeout: 15000 });
        expect((await remoteCar.getAttribute("transform")) ?? "").not.toContain("scale(-1, 1)");
    } finally {
        await watcher.close();
        await mover.close();
    }
});
