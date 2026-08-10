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
const USER = {
    email: `e2e-${RUN}@example.com`,
    username: `e2e${RUN}`,
    password: "password123",
};

test.describe.configure({ mode: "serial" });

/** The login overlay covers the scene until a user is stored. */
async function signUp(page) {
    await page.goto("/");
    await page.getByRole("button", { name: "Sign Up" }).click();
    await page.locator('input[name="email"]').fill(USER.email);
    await page.locator('input[name="username"]').fill(USER.username);
    await page.locator('input[name="password"]').fill(USER.password);
    await page.locator('input[name="passwordRepeat"]').fill(USER.password);
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

test("logging in with a wrong password shows an error and keeps the form usable", async ({ page }) => {
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

test("parking at a theater opens its info panel, and joining enters the theater", async ({ page }) => {
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
    await expect(page.locator(".timeOfMovie h1").first()).toContainText(/Starts in|Ongoing|Closing|Closed/);
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

        // A second visitor joins. It never presses a key, so its car has no
        // `direction` at all.
        const moverPage = await mover.newPage();
        await moverPage.goto("/");

        const remoteCar = watcherPage.locator(".remoteCar svg").first();
        await expect(remoteCar).toBeVisible({ timeout: 15000 });
        expect((await remoteCar.getAttribute("transform")) ?? "").not.toContain("scale(-1, 1)");
    } finally {
        await watcher.close();
        await mover.close();
    }
});
