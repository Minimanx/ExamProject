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
function nextIp() {
    ipCounter += 1;
    return `10.1.${Math.floor(ipCounter / 256) % 256}.${ipCounter % 256}`;
}

test.beforeEach(async ({ page }) => {
    await page.setExtraHTTPHeaders({ "X-Forwarded-For": nextIp() });
});

/**
 * A second browser context that also gets its own rate-limit bucket.
 *
 * beforeEach only sets the header on the fixture's page, so a context created
 * inside a test logs in from 127.0.0.1 — and every two-context test in the file
 * therefore shares one bucket. That stays invisible until enough of them exist
 * to reach ten logins, at which point a login silently 429s and the test fails
 * somewhere far away, looking like a socket problem.
 */
async function contextWithOwnBucket(browser) {
    return browser.newContext({
        extraHTTPHeaders: { "X-Forwarded-For": nextIp() },
        // A context made here does not inherit the project's `use` block, so the
        // microphone grant has to be repeated. Without it getUserMedia never
        // settles — it does not reject, it simply waits — and a call joins,
        // lists everyone, and is silent, with nothing on screen to say why.
        permissions: ["microphone"],
    });
}

/** Log in on a page from a second context, and prove it worked. */
async function logInOn(page, account) {
    await page.goto("/");
    await page.locator('input[name="email"]').fill(account.email);
    await page.locator('input[name="password"]').fill(account.password);
    await page.getByRole("button", { name: "Login" }).click();
    // The scene container is visible while logged out too — the login overlay
    // sits on top of it — so asserting it proves nothing. The overlay going away
    // is what says the login succeeded.
    await expect(page.locator(".blackedout")).toHaveCount(0);
}

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

async function logIn(page, account = USER) {
    await page.goto("/");
    await page.locator('input[name="email"]').fill(account.email);
    await page.locator('input[name="password"]').fill(account.password);
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

// If the listing request fails, nothing ever set `theatersLoaded`, so the app
// sat on its loading spinner forever — no message, no retry, no indication that
// anything had gone wrong. A server hiccup became a permanently broken tab.
test("a failed load says so instead of spinning forever", async ({ page }) => {
    await page.route("**/theaters", (route) =>
        route.fulfill({ status: 500, contentType: "application/json", body: "{}" })
    );

    await page.goto("/");

    await expect(page.getByText(/could not reach/i)).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole("button", { name: /try again/i })).toBeVisible();
});

test("the retry button actually retries", async ({ page }) => {
    let failNext = true;
    await page.route("**/theaters", (route) => {
        if (failNext) {
            failNext = false;
            return route.fulfill({ status: 500, contentType: "application/json", body: "{}" });
        }
        return route.continue();
    });

    await page.goto("/");
    await expect(page.getByRole("button", { name: /try again/i })).toBeVisible({ timeout: 15000 });

    await page.getByRole("button", { name: /try again/i }).click();

    await expect(page.locator(".containerInteractiveSpace")).toBeVisible({ timeout: 15000 });
});

// The theater page had the same fault the world did: nothing checked the
// response, so a theater that has closed, or one you are not allowed into,
// left the page spinning forever with no explanation and no way back.
test("a theater that cannot be loaded says so and offers a way out", async ({ page }) => {
    await logIn(page);
    // Scoped to the API. A bare "**/theaters/*" also matches the page's own
    // navigation, so the browser renders the JSON instead of the app.
    await page.route(`${API}/theaters/*`, (route) =>
        route.fulfill({
            status: 404,
            contentType: "application/json",
            body: JSON.stringify({ message: "Theater not found", code: "NOT_FOUND" }),
        })
    );

    await page.goto("/theaters/000000000000000000000009");

    await expect(page.getByText(/could not open/i)).toBeVisible({ timeout: 15000 });
    const back = page.getByRole("link", { name: /back to the world/i });
    await expect(back).toBeVisible();

    await back.click();
    await expect(page.locator(".containerInteractiveSpace")).toBeVisible();
});

// The login overlay stops the mouse, because it is a box on top of everything.
// It does nothing about the keyboard: tab out of the password field and you land
// in the hub chat behind it, type a message, press Enter, and nothing happens
// with no explanation. The logout button is back there too.
test("nothing behind the login overlay can be reached by keyboard", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".blackedout")).toHaveCount(1);

    const reachable = await page.evaluate(() => {
        const login = document.querySelector('input[name="email"]').closest("div");
        return [
            ...document.querySelectorAll(
                'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
            ),
        ]
            .filter((el) => {
                const rect = el.getBoundingClientRect();
                if (rect.width === 0 || rect.height === 0) return false;
                // `inert` removes a subtree from the tab order entirely.
                return !el.closest("[inert]") && !login.contains(el);
            })
            .map((el) => el.name || el.id || el.tagName);
    });

    expect(reachable).toEqual([]);
});

// The client keeps "am I logged in" in localStorage, which outlives the session
// it describes. Without checking, the app renders the entire world for somebody
// the server does not know — driving around, typing into a chat that goes
// nowhere, invisible to everyone. It looks completely fine, which is what makes
// it bad.
// Logging in is two things: the server accepting the password, and the browser
// keeping the cookie that stands for the session. Only the first was checked, so
// a browser that drops the cookie — a private window, where third-party cookies
// are blocked by default, and the API is a separate origin from the page — went
// straight into the world as somebody the server had never heard of. The first
// thing they tried then answered "Must be logged in to join theater".
test("says so when the browser does not keep the session cookie", async ({ page }) => {
    // Scoped to the API: the page's own routes must keep working, and an
    // unscoped pattern matches them too.
    await page.route(`${API}/me`, (route) =>
        route.fulfill({
            status: 401,
            contentType: "application/json",
            body: JSON.stringify({ message: "Must be logged in", code: "UNAUTHENTICATED" }),
        })
    );

    await page.goto("/");
    await page.locator('input[name="email"]').fill(USER.email);
    await page.locator('input[name="password"]').fill(USER.password);
    await page.getByRole("button", { name: "Login" }).click();

    // Told what actually happened, rather than shown a world that does not work.
    await expect(page.locator(".toastContainer, body")).toContainText(
        /did not keep the session cookie/i,
        { timeout: 10000 }
    );
    // And still on the login overlay, because nothing was signed in.
    await expect(page.locator(".blackedout")).toHaveCount(1);
});

test("a stored session the server has forgotten sends you back to the login", async ({ page }) => {
    await logIn(page);
    await expect(page.locator(".blackedout")).toHaveCount(0);

    // Exactly what a server restart, an expiry, or a logout in another tab
    // leaves behind: the local record without the session it describes.
    await page.request.get(`${API}/logout`);
    await page.reload();

    await expect(page.locator(".blackedout")).toHaveCount(1);
    await expect(page.locator('input[name="email"]')).toBeVisible();
});

// The other half of the same rule: a session the server does recognise must not
// be thrown away, or every reload would log everyone out.
test("a session the server still knows survives a reload", async ({ page }) => {
    await logIn(page);

    await page.reload();

    await expect(page.locator(".blackedout")).toHaveCount(0);
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

// Phase 4 gave the server the authoritative position and a speed limit. The
// failure mode that matters is not a cheat getting through — it is an honest
// player being corrected for driving normally, which would show as a car that
// stutters or snaps backwards. Driving a long way and checking the distance
// covered is what tells those apart: a corrected client would keep being pulled
// back and cover far less ground.
test("driving for a while is not fought by the server", async ({ page }) => {
    await logIn(page);

    const worldX = async () => {
        const style = await page.locator(".playerCar").getAttribute("style");
        const scroll = await page.locator(".world").getAttribute("style");
        const player = Number(style.match(/translate3d\((-?[\d.]+)px/)[1]);
        const offset = Number(scroll.match(/translate3d\((-?[\d.]+)px/)[1]);
        return player - offset;
    };

    const before = await worldX();
    await page.keyboard.down("d");
    await page.waitForTimeout(1500);
    await page.keyboard.up("d");
    const covered = (await worldX()) - before;

    // 250 px/s for 1.5s is 375px. Generous either side for frame timing and for
    // the world's own right-hand edge, but far above what a fought client would
    // manage.
    expect(covered).toBeGreaterThan(200);
});

// Diagonal driving covered 1.414x the ground of a straight line, which the
// server's speed limit refuses — so holding two keys snapped the car backwards
// every frame. The straight-line test above cannot see it: it only presses one
// key.
test("driving diagonally is not fought by the server either", async ({ page }) => {
    await logIn(page);

    // Both read in one evaluate. Fetching them as two separate calls lets a
    // frame land in between, so the car's position and the world's scroll
    // describe different instants — and their difference shows a jump that
    // never happened. That made this test fail about one run in four.
    const worldPosition = () =>
        page.evaluate(() => {
            const car = document.querySelector(".playerCar").getAttribute("style");
            const world = document.querySelector(".world").getAttribute("style");
            const at = (style, group) =>
                Number(style.match(/translate3d\((-?[\d.]+)px,\s*(-?[\d.]+)px/)[group]);
            return { x: at(car, 1) - at(world, 1), y: at(car, 2) };
        });

    // Sampled rather than measured end to end. Net distance is a bad detector:
    // a refused proposal leaves the server where it was, so the next one has a
    // bigger budget and is accepted — the car still gets there, in a sawtooth.
    // What the player sees is the backwards half of that sawtooth, so that is
    // what to assert.
    await page.keyboard.down("d");
    await page.keyboard.down("w");

    const samples = [];
    for (let i = 0; i < 25; i++) {
        samples.push(await worldPosition());
        await page.waitForTimeout(50);
    }

    await page.keyboard.up("w");
    await page.keyboard.up("d");

    const backwards = samples.filter(
        (sample, index) => index > 0 && sample.x < samples[index - 1].x - 1
    );
    expect(backwards).toEqual([]);

    // And it did actually travel, so an unmoving car cannot pass by never
    // going backwards.
    expect(samples.at(-1).x - samples[0].x).toBeGreaterThan(100);
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

// Phase 3 exit criterion: two people can find each other by search. The strip
// seeds Movie Night / The Matrix, Sci-Fi Fest / Blade Runner and Noir Evening /
// Chinatown, so a search has something to narrow.
test("searching the list view narrows it, by event and by film", async ({ page }) => {
    await logIn(page);

    const names = () => page.locator(".containerListView .names").allTextContents();
    const search = page.getByPlaceholder(/search/i);

    expect((await names()).length).toBeGreaterThan(1);

    // Polling on the contents, not the count: two consecutive searches that both
    // return one row make a length assertion pass on the previous result.
    await search.fill("noir");
    await expect.poll(names).toEqual([expect.stringContaining("Noir Evening")]);

    // Searching the film, not the name the host gave the evening.
    await search.fill("blade");
    await expect.poll(names).toEqual([expect.stringContaining("Sci-Fi Fest")]);

    await search.fill("");
    await expect.poll(async () => (await names()).length).toBeGreaterThan(1);
});

// The listing has taken hasSpace and startingWithin since Phase 3.2, both
// validated and tested on the server. Nothing in the UI ever sent them, so the
// only way to filter the strip was to type into the search box.
test("filtering by room and by how soon it starts", async ({ page }) => {
    await logIn(page);

    const names = () => page.locator(".containerListView .names").allTextContents();
    expect((await names()).length).toBeGreaterThan(1);

    // The seeded strip is three roomy events an hour out, so each filter has
    // something to keep and something to drop.
    await page.locator('input[name="hasSpace"]').check();
    await expect.poll(async () => (await names()).length).toBeGreaterThan(1);

    await page.locator('select[name="startingWithin"]').selectOption("30");
    await expect.poll(names).toEqual([]);
    await expect(page.locator(".containerListView")).toContainText(/no events match/i);

    // And clearing every filter brings the whole strip back, rather than
    // leaving the last result set on screen.
    await page.locator('select[name="startingWithin"]').selectOption("");
    await page.locator('input[name="hasSpace"]').uncheck();
    await expect.poll(async () => (await names()).length).toBeGreaterThan(1);
});

test("the sort headers can be reached and used by keyboard", async ({ page }) => {
    await logIn(page);

    const names = () => page.locator(".containerListView .names").allTextContents();
    const header = page.getByRole("button", { name: "Name/Movie" });

    await header.focus();
    await expect(header).toBeFocused();
    await page.keyboard.press("Enter");

    const ascending = await names();
    expect([...ascending].sort()).toEqual(ascending);
});

test("a search that matches nothing says so rather than showing everything", async ({ page }) => {
    await logIn(page);

    await page.getByPlaceholder(/search/i).fill("nosuchfilmanywhere");

    await expect.poll(() => page.locator(".containerListView .names").count()).toBe(0);
    await expect(page.locator(".containerListView")).toContainText(/no (events|theaters) match/i);
});

// Phase 5: friends. The two accounts the suite shares are the natural pair, and
// the request has to be answered by the other one — the whole point of keeping
// who asked is that they cannot accept on their own behalf.
test("adding a friend, from request through to accepted", async ({ browser }) => {
    const askerContext = await contextWithOwnBucket(browser);
    const targetContext = await contextWithOwnBucket(browser);
    try {
        const asker = await askerContext.newPage();
        await logInOn(asker, USER);
        await asker.getByRole("button", { name: "Friends" }).click();

        await asker.locator('input[name="friendUsername"]').fill(MOVER.username);
        await asker.getByRole("button", { name: "Add", exact: true }).click();
        await expect(asker.locator("._toastContainer")).toContainText(/Friend request sent/i);

        // From the asker's side it is an outstanding request, not a friend.
        await expect(asker.getByText("Asked")).toBeVisible();

        const target = await targetContext.newPage();
        await logInOn(target, MOVER);
        await target.getByRole("button", { name: "Friends" }).click();

        await expect(target.getByText("Wants to be your friend")).toBeVisible();
        await target.getByRole("button", { name: "Accept" }).click();
        await expect(target.locator("._toastContainer")).toContainText(/Friend added/i);

        // And now they are listed as a friend, with a presence dot.
        await expect(target.locator(".presence")).toHaveCount(1);
    } finally {
        await askerContext.close();
        await targetContext.close();
    }
});

// Clubs had seven endpoints and no interface: no way to create one, browse
// them, join or leave. The public page existed but could only be reached by
// somebody who already had the slug, which is the opposite of discovery.
test("a club can be started, found and joined without leaving the app", async ({ browser }) => {
    const founderContext = await contextWithOwnBucket(browser);
    const joinerContext = await contextWithOwnBucket(browser);
    try {
        const founder = {
            email: `founder-${RUN}@example.com`,
            username: `founder${RUN}`,
            password: "password123",
        };
        const page = await founderContext.newPage();
        await page.request.post(`${API}/users`, {
            data: { ...founder, passwordRepeat: founder.password },
            failOnStatusCode: false,
        });
        await logInOn(page, founder);

        await page.getByRole("button", { name: "Clubs" }).click();
        await expect(page.getByText("You are not in a club yet.")).toBeVisible();

        await page.getByRole("button", { name: "Start a club" }).click();
        await page.locator('input[name="clubName"]').fill(`Tuesday Westerns ${RUN}`);
        await page.locator('input[name="clubDescription"]').fill("Horses, dust, silence.");
        await page.locator('select[name="clubWeekday"]').selectOption("2");
        await page.locator('input[name="clubTime"]').fill("19:30");
        await page.getByRole("button", { name: "Create club" }).click();

        await expect(page.getByText(`Tuesday Westerns ${RUN}`)).toBeVisible();
        await expect(page.getByText("Tuesdays at 19:30", { exact: false })).toBeVisible();

        // Someone else finds it in the same panel and joins.
        const joinerPage = await joinerContext.newPage();
        await logInOn(joinerPage, MOVER);
        await joinerPage.getByRole("button", { name: "Clubs" }).click();

        const row = joinerPage
            .locator("li")
            .filter({ hasText: `Tuesday Westerns ${RUN}` })
            .first();
        await row.getByRole("button", { name: "Join" }).click();

        // It moves from "open to join" into "yours", as a member.
        await expect(joinerPage.getByText("member", { exact: false }).first()).toBeVisible();
        await expect(row.getByRole("button", { name: "Leave" })).toBeVisible();

        // The sole owner is offered Delete rather than Leave: the server always
        // refuses to let the last owner go, so the other button never works.
        const ownersRow = page
            .locator("li")
            .filter({ hasText: `Tuesday Westerns ${RUN}` })
            .first();
        await expect(ownersRow.getByRole("button", { name: "Delete" })).toBeVisible();
        await expect(ownersRow.getByRole("button", { name: "Leave" })).toHaveCount(0);

        // And the club states its schedule without repeating the reader's own
        // timezone back at them.
        await expect(page.getByText("Tuesdays at 19:30", { exact: true })).toBeVisible();
    } finally {
        await founderContext.close();
        await joinerContext.close();
    }
});

// The directory is the other half of discovery: a page worth linking to that
// lists what is on, rendered by the server so it means something to whatever
// fetches it first.
test("the public club directory lists clubs and links to them", async ({ page, request }) => {
    const owner = {
        email: `directory-${RUN}@example.com`,
        username: `direct${RUN}`,
        password: "password123",
    };
    await request.post(`${API}/users`, {
        data: { ...owner, passwordRepeat: owner.password },
        failOnStatusCode: false,
    });
    await logIn(page, owner);
    const created = await page.request.post(`${API}/clubs`, {
        data: {
            name: `Directory Club ${RUN}`,
            description: "Listed for all to see.",
            isPublic: true,
            schedule: { weekday: 5, hour: 21, minute: 0, timeZone: "Europe/Copenhagen" },
        },
        failOnStatusCode: false,
    });
    const { slug } = (await created.json()).data;

    const html = await (await page.request.get("/clubs")).text();
    expect(html).toContain(`Directory Club ${RUN}`);
    expect(html).toContain("Fridays at 21:00");

    await page.goto("/clubs");
    await page.getByRole("link", { name: `Directory Club ${RUN}` }).click();

    await expect(page).toHaveURL(new RegExp(`/clubs/${slug}$`));
    await expect(page.getByRole("heading", { name: `Directory Club ${RUN}` })).toBeVisible();
});

// Phase 5: the spec named club discovery as "where SvelteKit's SSR starts paying
// rent". A page that only renders once JavaScript runs is worth nothing to
// whatever fetches a shared link first, so what matters is that the HTML the
// server sends already contains the club.
test("a public club page is rendered by the server", async ({ page, request }) => {
    const owner = {
        email: `clubowner-${RUN}@example.com`,
        username: `clubown${RUN}`,
        password: "password123",
    };
    await request.post(`${API}/users`, {
        data: { ...owner, passwordRepeat: owner.password },
        failOnStatusCode: false,
    });
    await logIn(page, owner);

    const created = await page.request.post(`${API}/clubs`, {
        data: {
            name: `Noir Night ${RUN}`,
            description: "Rain, hats, moral ambiguity.",
            isPublic: true,
            schedule: { weekday: 4, hour: 20, minute: 0, timeZone: "Europe/Copenhagen" },
        },
        failOnStatusCode: false,
    });
    expect(created.status()).toBe(200);
    const { slug } = (await created.json()).data;

    // Fetched as bytes, with no browser and no JavaScript: this is what a link
    // preview or a crawler sees.
    const html = await (await page.request.get(`/clubs/${slug}`)).text();
    expect(html).toContain(`Noir Night ${RUN}`);
    expect(html).toContain("Rain, hats, moral ambiguity.");
    expect(html).toContain("Thursdays at 20:00");
    expect(html).toContain(owner.username);

    // And it works as a page too.
    await page.goto(`/clubs/${slug}`);
    await expect(page.getByRole("heading", { name: `Noir Night ${RUN}` })).toBeVisible();
    await expect(page.getByText(/Next: .* at /)).toBeVisible();
});

// The club page renders straight onto the body, which is dark with dark text —
// that works everywhere else only because every panel paints its own light
// background. The first version of this page was near-black on near-black and
// perfectly functional, which is exactly how it would have shipped.
test("a public club page is actually readable", async ({ page, request }) => {
    const owner = {
        email: `contrast-${RUN}@example.com`,
        username: `contrast${RUN}`,
        password: "password123",
    };
    await request.post(`${API}/users`, {
        data: { ...owner, passwordRepeat: owner.password },
        failOnStatusCode: false,
    });
    await logIn(page, owner);

    const created = await page.request.post(`${API}/clubs`, {
        data: { name: `Readable ${RUN}`, description: "Legible.", isPublic: true, schedule: null },
        failOnStatusCode: false,
    });
    const { slug } = (await created.json()).data;

    await page.goto(`/clubs/${slug}`);

    const contrast = await page.evaluate(() => {
        const luminance = (colour) => {
            const [r, g, b] = colour.match(/\d+/g).map(Number);
            const channel = (value) => {
                const v = value / 255;
                return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
            };
            return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
        };

        const heading = document.querySelector("h1");
        const text = getComputedStyle(heading).color;
        // The nearest ancestor that actually paints something.
        let node = heading;
        let background = "rgba(0, 0, 0, 0)";
        while (node && background === "rgba(0, 0, 0, 0)") {
            background = getComputedStyle(node).backgroundColor;
            node = node.parentElement;
        }

        const a = luminance(text);
        const b = luminance(background);
        return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    });

    // 4.5:1 is the ordinary threshold for body text being legible.
    expect(contrast).toBeGreaterThan(4.5);
});

test("a private club page is not found rather than forbidden", async ({ page, request }) => {
    const owner = {
        email: `privateowner-${RUN}@example.com`,
        username: `privown${RUN}`,
        password: "password123",
    };
    await request.post(`${API}/users`, {
        data: { ...owner, passwordRepeat: owner.password },
        failOnStatusCode: false,
    });
    await logIn(page, owner);

    const created = await page.request.post(`${API}/clubs`, {
        data: { name: `Secret ${RUN}`, description: "", isPublic: false, schedule: null },
        failOnStatusCode: false,
    });
    const { slug } = (await created.json()).data;

    // A separate context has no session, so it is a stranger. 403 would confirm
    // the club exists, which is what someone guessing slugs wants to learn.
    const response = await request.get(`http://localhost:8123/clubs/${slug}`, {
        failOnStatusCode: false,
    });
    expect(response.status()).toBe(404);
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

    // The submit button has its own id now, so no scoping gymnastics: the one
    // in the scene opens the form, this one submits it.
    const panel = page.locator(".panel").filter({ has: page.locator('input[name="eventName"]') });

    await page.locator('input[name="eventName"]').fill("Runes Night");
    await page.locator('input[name="searchMovie"]').first().fill("interstellar");
    await page.locator('input[name="searchMovie"]').first().dispatchEvent("change");

    // The result list renders once the (intercepted) search resolves. Scope to
    // the panel: an unscoped "ul" also matches the toast container.
    const result = panel.locator(".movieRow").filter({ hasText: "Interstellar" }).first();
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

    await page.locator("#submitEventButton").click();
    await expect(page.locator("._toastContainer")).toContainText(
        /Event Created|already have an ongoing event/i
    );
});

// Phase 3 replaced the host-invented theater password with a server-generated
// lobby key. The key is returned once, on creation, and projected out of every
// listing afterwards — so the moment it appears on screen is the only moment it
// exists anywhere the host can see it.
test("creating a private event shows an invite link exactly once", async ({ page }) => {
    await page.route("**/movies?s=*", (route) =>
        route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
                data: {
                    Response: "True",
                    Search: [
                        { Title: "Solaris", Year: "1972", imdbID: "tt0069293", Poster: "N/A" },
                    ],
                },
            }),
        })
    );

    // A fresh account: MAX_EVENTS_PER_OWNER is 1, so the account the other
    // tests share may already be hosting.
    const host = {
        email: `host-${RUN}@example.com`,
        username: `host${RUN}`,
        password: "password123",
    };
    await page.request.post(`${API}/users`, {
        data: { ...host, passwordRepeat: host.password },
        failOnStatusCode: false,
    });

    await logIn(page, host);
    await page.getByRole("button", { name: "Create Event" }).first().click();

    const panel = page.locator(".panel").filter({ has: page.locator('input[name="eventName"]') });

    await page.locator('input[name="eventName"]').fill("Private Night");
    await page.locator('input[name="searchMovie"]').first().fill("solaris");
    await page.locator('input[name="searchMovie"]').first().dispatchEvent("change");
    const result = panel.locator(".movieRow").filter({ hasText: "Solaris" }).first();
    await expect(result).toBeVisible();
    await result.dispatchEvent("click");

    const soon = new Date(Date.now() + 90 * 60 * 1000);
    await page
        .locator('input[name="startTime"]')
        .fill(
            `${String(soon.getHours()).padStart(2, "0")}:${String(soon.getMinutes()).padStart(2, "0")}`
        );
    await page.locator('input[name="amountOfSpaces"]').fill("10");
    await panel.locator("#passwordCheckbox").check();

    await page.locator("#submitEventButton").click();

    const link = panel.locator('input[name="inviteLink"]');
    await expect(link).toBeVisible();
    expect(await link.inputValue()).toMatch(/\?theater=[a-f0-9]{24}&key=[0-9a-f]{16}$/);

    // The key is shown exactly once and never again, so a box that spills out of
    // its panel is not a cosmetic problem — it is the only copy, unreadable.
    const box = await link.boundingBox();
    const within = await panel.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(within.x - 1);
    expect(box.x + box.width).toBeLessThanOrEqual(within.x + within.width + 1);

    // And the event says so. Lobby keys renamed the field these two views read,
    // so a private event announced itself as "Public Event" on its own marquee
    // and drew the open padlock in the listing — the host ticked the box, was
    // handed a key, and the event advertised itself as open to anyone.
    await page.getByRole("button", { name: "Done" }).click();
    await expect(page.locator(".lotSlot").filter({ hasText: "Private Night" })).toContainText(
        "Private Event"
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

// Phase 3 exit criterion: two people watch a film with synchronized play/pause.
//
// No video is loaded here — a real file would make the suite depend on a media
// asset and on codec support. What is asserted is the part that has to be right
// for two people to watch together: the host drives, the guest follows, and the
// guest cannot drive.
test("someone who is not the host gets no playback controls", async ({ page }) => {
    await logIn(page);
    await page.keyboard.down("w");
    await page.waitForTimeout(700);
    await page.keyboard.up("w");
    await page.getByRole("button", { name: /^join$/i }).click();
    await expect(page.locator(".liveChatContainer")).toBeVisible();

    // The seeded theaters carry a placeholder ownerID, so nobody in the suite
    // owns one.
    await expect(page.locator('button[name="play"]')).toHaveCount(0);
    await expect(page.locator('button[name="readyCheck"]')).toHaveCount(0);
    await expect(page.locator(".hostOnly")).toContainText(/the host has the controls/i);
});

// The private invite link carries the event and its one-time key, and the key is
// picked up at the sign. Getting to the sign was left to the recipient: the link
// dropped them at the world spawn to drive the strip looking for the right
// marquee, while the public "invite to this event" link — which needs no key at
// all — teleports.
test("a private invite link takes you to the event, key in hand", async ({ page, request }) => {
    const host = {
        email: `invited-${RUN}@example.com`,
        username: `invited${RUN}`,
        password: "password123",
    };
    await request.post(`${API}/users`, {
        data: { ...host, passwordRepeat: host.password },
        failOnStatusCode: false,
    });

    await logIn(page, host);

    const soon = new Date(Date.now() + 60 * 60 * 1000);
    const created = await page.request.post(`${API}/theaters`, {
        data: {
            data: {
                eventName: "By Invitation",
                imdbID: "tt0133093",
                amountOfSpaces: 10,
                startTime: soon.toISOString(),
                private: true,
            },
        },
        failOnStatusCode: false,
    });
    expect(created.status()).toBe(200);
    const { theaterId, lobbyKey } = await created.json();
    expect(lobbyKey).toBeTruthy();

    await page.goto(`/?theater=${theaterId}&key=${lobbyKey}`);

    // Arriving at the sign is what opens the panel, so this is the teleport.
    await expect(page.locator(".panel")).toContainText("By Invitation");
    // The key came with the link, so the panel neither asks for one nor claims
    // you need one — and there is a way in.
    await expect(page.locator(".panel")).toContainText(/your invite link opens this one/i);
    await expect(page.locator('input[name="lobbyKey"]')).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^join$/i })).toBeVisible();
});

// The camera control is hidden until somebody it is allowed with is actually in
// the call. Saying why used one message for two different situations, so being
// alone in a call read as "the camera is only available with friends" — which is
// not true, and is confusing precisely when you are sitting in a private event
// with a friend who has not pressed Join voice yet.
test("alone in a call, the camera says who is missing rather than blaming friendship", async ({
    page,
    request,
}) => {
    const solo = {
        email: `solo-${RUN}@example.com`,
        username: `solo${RUN}`,
        password: "password123",
    };
    await request.post(`${API}/users`, {
        data: { ...solo, passwordRepeat: solo.password },
        failOnStatusCode: false,
    });
    await logIn(page, solo);

    const created = await page.request.post(`${API}/theaters`, {
        data: {
            data: {
                eventName: "Alone Night",
                imdbID: "tt0133093",
                amountOfSpaces: 10,
                startTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
            },
        },
        failOnStatusCode: false,
    });
    expect(created.status()).toBe(200);
    const { theaterId } = await created.json();
    await page.request.patch(`${API}/theaters/${theaterId}`, {
        data: {
            joining: true,
            userID: await page.evaluate(() => JSON.parse(localStorage.getItem("user")).userID),
        },
        failOnStatusCode: false,
    });

    await page.goto(`/theaters/${theaterId}`);
    await expect(page.locator(".liveChatContainer")).toBeVisible();
    await page.locator('button[name="joinVoice"]').click();
    await expect(page.locator('button[name="leaveVoice"]')).toBeVisible();

    await expect(page.locator(".voice")).not.toContainText(/only available with friends/i);
    await expect(page.locator(".voice")).toContainText(/nobody else/i);
});

test("the host of their own event gets the controls", async ({ page, request }) => {
    // A fresh account, because MAX_EVENTS_PER_OWNER is 1 and the shared account
    // may already be hosting by the time this runs.
    const host = {
        email: `owner-${RUN}@example.com`,
        username: `owner${RUN}`,
        password: "password123",
    };
    await request.post(`${API}/users`, {
        data: { ...host, passwordRepeat: host.password },
        failOnStatusCode: false,
    });

    await logIn(page, host);

    // Created through the API rather than the form: this test is about who owns
    // playback, and the creation flow has its own tests.
    const soon = new Date(Date.now() + 60 * 60 * 1000);
    const created = await page.request.post(`${API}/theaters`, {
        data: {
            data: {
                eventName: "Owned Night",
                imdbID: "tt0133093",
                amountOfSpaces: 10,
                startTime: soon.toISOString(),
            },
        },
        failOnStatusCode: false,
    });
    expect(created.status()).toBe(200);
    const { theaterId } = await created.json();

    const joined = await page.request.patch(`${API}/theaters/${theaterId}`, {
        data: {
            joining: true,
            userID: await page.evaluate(() => JSON.parse(localStorage.getItem("user")).userID),
        },
        failOnStatusCode: false,
    });
    expect(joined.status()).toBe(200);

    await page.goto(`/theaters/${theaterId}`);
    await expect(page.locator(".liveChatContainer")).toBeVisible();

    await expect(page.locator('button[name="play"]')).toBeVisible();
    await expect(page.locator('button[name="readyCheck"]')).toBeVisible();
    await expect(page.locator('button[name="startCountdown"]')).toBeVisible();
});

// The film is opened from the viewer's own disk and never uploaded. If this
// ever grows a request, the promise the feature is built on has broken.
test("choosing a film uploads nothing", async ({ page }) => {
    await logIn(page);
    await page.keyboard.down("w");
    await page.waitForTimeout(700);
    await page.keyboard.up("w");
    await page.getByRole("button", { name: /^join$/i }).click();
    await expect(page.locator(".liveChatContainer")).toBeVisible();

    const uploads = [];
    page.on("request", (request) => {
        if (request.method() === "POST" && (request.postData()?.length ?? 0) > 10_000) {
            uploads.push(request.url());
        }
    });

    await page
        .locator('input[name="filmFile"]')
        .setInputFiles({ name: "film.webm", mimeType: "video/webm", buffer: Buffer.alloc(64_000) });
    await page.waitForTimeout(1000);

    expect(uploads).toEqual([]);
    await expect(page.locator("video.film")).toBeVisible();
});

// Phase 3 exit criterion: two people can chat in the open world. Both players
// start at the same spawn point, so they are within earshot without either
// having to drive.
test("a message in the hub appears as a bubble on both screens", async ({ browser }) => {
    const speaker = await contextWithOwnBucket(browser);
    const listener = await contextWithOwnBucket(browser);
    try {
        const speakerPage = await speaker.newPage();
        await logInOn(speakerPage, USER);

        const listenerPage = await listener.newPage();
        await logInOn(listenerPage, MOVER);

        // Both have to have reported a position before either can be placed on
        // the map, and a bubble only reaches sockets whose position is known.
        await expect(listenerPage.locator(".remoteCar")).toHaveCount(1, { timeout: 15000 });

        await speakerPage.locator('input[name="hubMessage"]').fill("anyone up for Solaris?");
        await speakerPage.locator('input[name="hubMessage"]').press("Enter");

        // On the listener's screen it belongs to the other player's car.
        await expect(listenerPage.locator(".remoteCar .bubble")).toContainText(
            "anyone up for Solaris?",
            { timeout: 10000 }
        );
        // And the speaker sees their own, over their own car.
        await expect(speakerPage.locator(".playerCar .bubble")).toContainText(
            "anyone up for Solaris?"
        );

        // The input clears, so the next message does not append to the last.
        await expect(speakerPage.locator('input[name="hubMessage"]')).toHaveValue("");
    } finally {
        await speaker.close();
        await listener.close();
    }
});

// Typing "w" in the chat box must not also drive the car forwards.
test("typing in the hub chat does not drive the car", async ({ page }) => {
    await logIn(page);

    const position = () => page.locator(".playerCar").getAttribute("style");
    const before = await position();

    await page.locator('input[name="hubMessage"]').fill("wasd");
    await page.waitForTimeout(400);

    expect(await position()).toBe(before);
});

test("a remote car that has never moved is not mirrored", async ({ browser }) => {
    const watcher = await contextWithOwnBucket(browser);
    const mover = await contextWithOwnBucket(browser);
    try {
        const watcherPage = await watcher.newPage();
        await logInOn(watcherPage, USER);

        // A second player joins and never presses a key, so its car has no
        // `direction` at all. It must log in: since defect S4 was fixed, an
        // unauthenticated socket cannot broadcast a car, so anonymous visitors
        // no longer appear in the world.
        const moverPage = await mover.newPage();
        await logInOn(moverPage, MOVER);

        const remoteCar = watcherPage.locator(".remoteCar svg").first();
        await expect(remoteCar).toBeVisible({ timeout: 15000 });
        expect((await remoteCar.getAttribute("transform")) ?? "").not.toContain("scale(-1, 1)");
    } finally {
        await watcher.close();
        await mover.close();
    }
});

// Phase 6 exit criterion: people hold a voice conversation in a lobby with no
// server-side media relay beyond TURN. Two browsers is what proves the mesh
// connects at all — the cap that makes five the limit is enforced and tested on
// the server, where a client cannot argue with it.
//
// Chromium runs with a fake capture device, so the audio is a generated tone
// rather than a microphone, and the permission prompt answers itself. Everything
// else is real: real peer connections, real ICE, real SDP through the server.
test("two people connect a voice call in a lobby", async ({ browser, request }) => {
    // Two browsers, two peer connections and a real ICE exchange: minutes of
    // budget rather than the default thirty seconds, most of which is spent
    // waiting for candidates to be gathered and paired.
    test.setTimeout(120000);

    // Some machines cannot open a capture device at all, even with the fake one
    // and the permission granted: getUserMedia does not refuse, it simply never
    // settles. Skipped rather than left to time out, so the reason is legible
    // instead of arriving as a two-minute hang.
    const probe = await browser.newContext({ permissions: ["microphone"] });
    const probePage = await probe.newPage();
    await probePage.goto("/");
    const microphoneWorks = await probePage.evaluate(async () => {
        try {
            const stream = await Promise.race([
                navigator.mediaDevices.getUserMedia({ audio: true }),
                new Promise((_, reject) => setTimeout(() => reject(new Error("hung")), 8000)),
            ]);
            stream.getTracks().forEach((track) => track.stop());
            return true;
        } catch {
            return false;
        }
    });
    await probe.close();
    test.skip(!microphoneWorks, "no capture device available for a real peer connection");

    const host = {
        email: `voice-${RUN}@example.com`,
        username: `voice${RUN}`,
        password: "password123",
    };
    const guest = {
        email: `voiceb-${RUN}@example.com`,
        username: `voiceb${RUN}`,
        password: "password123",
    };
    for (const account of [host, guest]) {
        await request.post(`${API}/users`, {
            data: { ...account, passwordRepeat: account.password },
            failOnStatusCode: false,
        });
    }

    const first = await contextWithOwnBucket(browser);
    const second = await contextWithOwnBucket(browser);
    try {
        const hostPage = await first.newPage();
        await logInOn(hostPage, host);

        const created = await hostPage.request.post(`${API}/theaters`, {
            data: {
                data: {
                    eventName: "Voice Night",
                    imdbID: "tt0133093",
                    amountOfSpaces: 10,
                    startTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
                },
            },
            failOnStatusCode: false,
        });
        expect(created.status()).toBe(200);
        const { theaterId } = await created.json();

        const guestPage = await second.newPage();
        await logInOn(guestPage, guest);

        for (const [page, account] of [
            [hostPage, host],
            [guestPage, guest],
        ]) {
            await page.request.patch(`${API}/theaters/${theaterId}`, {
                data: {
                    joining: true,
                    userID: await page.evaluate(
                        () => JSON.parse(localStorage.getItem("user")).userID
                    ),
                },
                failOnStatusCode: false,
            });
            expect(account.email).toBeTruthy();
            await page.goto(`/theaters/${theaterId}`);
            await expect(page.locator(".liveChatContainer")).toBeVisible();
        }

        await hostPage.locator('button[name="joinVoice"]').click();
        await expect(hostPage.locator('button[name="leaveVoice"]')).toBeVisible();

        await guestPage.locator('button[name="joinVoice"]').click();
        await expect(guestPage.locator('button[name="leaveVoice"]')).toBeVisible();

        // Each sees the other in the call, by name.
        await expect(hostPage.locator(".voice .peers")).toContainText(guest.username, {
            timeout: 20000,
        });
        await expect(guestPage.locator(".voice .peers")).toContainText(host.username, {
            timeout: 20000,
        });

        // And the connection actually completes, rather than sitting in "new"
        // forever — which is what a mesh that signals but never connects does.
        const connected = async (page) =>
            page.evaluate(async () => {
                const start = Date.now();
                while (Date.now() - start < 20000) {
                    const audio = document.querySelector(".voice .peers audio");
                    if (audio?.srcObject?.getAudioTracks?.().length > 0) return true;
                    await new Promise((r) => setTimeout(r, 250));
                }
                return false;
            });

        expect(await connected(hostPage)).toBe(true);
        expect(await connected(guestPage)).toBe(true);

        // The camera is gated to friends, so with strangers there is no control
        // to press — only the reason there isn't.
        await expect(hostPage.locator(".voice")).toContainText(/only available with friends/i);
        await expect(hostPage.locator('button[name="toggleCamera"]')).toHaveCount(0);

        // Become friends, and it becomes available. The gate is enforced on the
        // server for every offer; this is the ordinary path through it.
        const asked = await hostPage.request.post(`${API}/friends`, {
            data: { username: guest.username },
            failOnStatusCode: false,
        });
        expect(asked.status()).toBe(200);
        const incoming = await guestPage.request.get(`${API}/friends`, {
            failOnStatusCode: false,
        });
        const { data: lists } = await incoming.json();
        expect(lists.incoming).toHaveLength(1);
        const answered = await guestPage.request.patch(`${API}/friends/${lists.incoming[0].id}`, {
            data: { accept: true },
            failOnStatusCode: false,
        });
        expect(answered.status()).toBe(200);

        // Rejoining is what asks the server again who may see a camera.
        for (const page of [hostPage, guestPage]) {
            await page.locator('button[name="leaveVoice"]').click();
            await expect(page.locator('button[name="joinVoice"]')).toBeVisible();
        }
        await hostPage.locator('button[name="joinVoice"]').click();
        await guestPage.locator('button[name="joinVoice"]').click();
        await expect(hostPage.locator('button[name="toggleCamera"]')).toBeVisible({
            timeout: 20000,
        });

        await hostPage.locator('button[name="toggleCamera"]').click();
        await expect(hostPage.locator('button[name="toggleCamera"]')).toContainText(/off/i);
        // Turning it on says nothing went wrong — in particular the server did
        // not refuse to carry it, which is what it does between strangers.
        await expect(hostPage.locator(".voice .failure")).toHaveCount(0);

        // And the far end negotiates a two-way video section rather than one it
        // can only receive on, which is what lets the camera be swapped in
        // without another round of negotiation.
        // Polled rather than sampled: the answer that carries this is applied
        // asynchronously, and reading once catches whichever moment the machine
        // happened to be in.
        await expect
            .poll(
                () =>
                    guestPage.evaluate(() => {
                        // The last one: they left and rejoined to pick up the
                        // friendship, so earlier connections predate it.
                        const pc = window.__voicePeerConnections?.at(-1);
                        const section = (pc?.remoteDescription?.sdp ?? "")
                            .split(/^m=/m)
                            .find((part) => part.startsWith("video"));
                        return (section ?? "").includes("a=sendrecv") ? "sendrecv" : "other";
                    }),
                { timeout: 20000 }
            )
            .toBe("sendrecv");

        // Leaving takes the person off the other screen.
        await guestPage.locator('button[name="leaveVoice"]').click();
        await expect(hostPage.locator(".voice .peers")).not.toContainText(guest.username, {
            timeout: 15000,
        });
    } finally {
        await first.close();
        await second.close();
    }
});
