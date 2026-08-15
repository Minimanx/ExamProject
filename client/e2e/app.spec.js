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
    return browser.newContext({ extraHTTPHeaders: { "X-Forwarded-For": nextIp() } });
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

// The client keeps "am I logged in" in localStorage, which outlives the session
// it describes. Without checking, the app renders the entire world for somebody
// the server does not know — driving around, typing into a chat that goes
// nowhere, invisible to everyone. It looks completely fine, which is what makes
// it bad.
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

    const worldPosition = async () => {
        const style = await page.locator(".playerCar").getAttribute("style");
        const scroll = await page.locator(".world").getAttribute("style");
        return {
            x:
                Number(style.match(/translate3d\((-?[\d.]+)px/)[1]) -
                Number(scroll.match(/translate3d\((-?[\d.]+)px/)[1]),
            y: Number(style.match(/translate3d\(-?[\d.]+px,\s*(-?[\d.]+)px/)[1]),
        };
    };

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

    const panel = page
        .locator("div.container")
        .filter({ has: page.locator('input[name="eventName"]') })
        .last();

    await page.locator('input[name="eventName"]').fill("Private Night");
    await page.locator('input[name="searchMovie"]').first().fill("solaris");
    await page.locator('input[name="searchMovie"]').first().dispatchEvent("change");
    const result = panel.locator("ul").filter({ hasText: "Solaris" }).first();
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

    await panel.getByRole("button", { name: "Create Event" }).click();

    const link = panel.locator('input[name="inviteLink"]');
    await expect(link).toBeVisible();
    expect(await link.inputValue()).toMatch(/\?theater=[a-f0-9]{24}&key=[0-9a-f]{16}$/);

    // The key is shown exactly once and never again, so a box that spills out of
    // its panel is not a cosmetic problem — it is the only copy, unreadable.
    const box = await link.boundingBox();
    const within = await panel.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(within.x - 1);
    expect(box.x + box.width).toBeLessThanOrEqual(within.x + within.width + 1);
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
