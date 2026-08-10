# Phase 0.1 + 0.2 — Server Test Harness & Upgrades Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put a characterization test suite around the existing 13 server endpoints, then upgrade Express, mongodb, and express-rate-limit and delete `node-fetch` — with the tests proving nothing changed.

**Architecture:** The server currently cannot be imported without side effects: `app.js` calls `server.listen()` at module scope and exports nothing, and `database/createConnection.js` performs a top-level `await client.connect()` that throws without `MONGODB_URI`. Task 1 splits the listener out so Supertest can drive the app in-process. Task 2 boots a real in-memory mongod and feeds its URI in via `process.env` before the app module graph is evaluated, so no production code needs to know it is under test. Tasks 3–9 pin current behaviour. Tasks 11–13 upgrade underneath that safety net.

**Tech Stack:** Node 24 LTS, Express 5, Socket.IO 4, mongodb driver 7, Vitest 4, Supertest 7, mongodb-memory-server 11. ESM throughout (`"type": "module"`).

## Global Constraints

- **Node target is 24 LTS.** Both `client/package.json` and `server/package.json` declare `engines.node: "24.x"`. CI runs on Node 24.
- **These are characterization tests, not correctness tests.** They assert what the code does *today*, including its bugs. Where a test pins known-wrong behaviour, it carries a comment naming the defect ID from the roadmap spec (`docs/superpowers/specs/2026-08-09-flixdrive-roadmap-design.md` §5). Phase 2 changes those assertions. **Do not "fix" behaviour in this plan.** The only behaviour changes permitted are the ones Task 11 forces.
- **No network calls in tests.** OMDB is mocked at the module boundary. A test that hits `omdbapi.com` is a failed test.
- Exact versions to install: `vitest@^4.1.10`, `supertest@^7.2.2`, `mongodb-memory-server@^11.2.0`, `express@^5.2.1`, `mongodb@^7.5.0`, `express-rate-limit@^8.6.2`.
- Database name is `FlixDrive`, hardcoded in `createConnection.js:17` and `app.js:51`. Do not change it.
- All commands run from `server/` unless stated otherwise.

---

## File Structure

**Created:**

| Path | Responsibility |
|---|---|
| `server/server.js` | Process entry point. Reads `PORT`, calls `server.listen()`. Nothing else. |
| `server/vitest.config.js` | Test runner config. |
| `server/test/globalSetup.js` | Boots one `MongoMemoryServer` for the whole run, provides its URI. |
| `server/test/setup.js` | Per-worker: sets env before app import, truncates collections between tests, closes the client at the end. |
| `server/test/helpers.js` | `registerUser`, `loginAgent`, `seedTheater`, `mockOmdb`. |
| `server/test/health.test.js` | `GET /health`. |
| `server/test/login.test.js` | `POST /login`, `GET /logout`. |
| `server/test/users.test.js` | `POST /users`. |
| `server/test/passwordReset.test.js` | `POST /forgotpassword`, `POST /resetpassword`, `PATCH /resetpassword`. |
| `server/test/movies.test.js` | `GET /movies`. |
| `server/test/theatersRead.test.js` | `GET /theaters`, `GET /theaters/:id`. |
| `server/test/theatersCreate.test.js` | `POST /theaters`. |
| `server/test/theatersJoinDelete.test.js` | `PATCH /theaters/:id`, `DELETE /theaters/:id`. |
| `.github/workflows/ci.yml` | Lint-free for now: install, test, build client. |

**Modified:**

| Path | Change |
|---|---|
| `server/app.js` | Remove `server.listen()`; export `{ app, server, io }`. Task 11 adds an error handler and fixes the wildcard route. |
| `server/package.json` | `main`/`start` → `server.js`; `engines` → 24.x; add `test` script and devDependencies; Tasks 12–13 bump deps. |
| `client/package.json` | `engines` → 24.x. |
| `server/routers/movieRouter.js` | Task 13: drop `node-fetch` import. |
| `server/routers/theaterRouter.js` | Task 13: drop `node-fetch` import. |

---

## Task 1: Make the app importable

Supertest needs the Express `app` object without a bound port. Right now importing `app.js` starts a listener on 5000 and returns nothing.

**Files:**
- Create: `server/server.js`
- Modify: `server/app.js:124-127`, `server/package.json`, `client/package.json`

**Interfaces:**
- Consumes: nothing.
- Produces: `server/app.js` exports `{ app, server, io }` — `app` is the configured `express()` instance, `server` is the `http.Server` wrapping it, `io` is the Socket.IO `Server`. Every test file imports `{ app }` from `../app.js`.

- [ ] **Step 1: Replace the listener block in `app.js` with an export**

Delete lines 124–127 of `server/app.js`:

```javascript
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log("Server running on port: ", PORT);
});
```

Replace with:

```javascript
export { app, server, io };
```

- [ ] **Step 2: Create the process entry point**

Create `server/server.js`:

```javascript
import { server } from "./app.js";

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
    console.log("Server running on port: ", PORT);
});
```

- [ ] **Step 3: Point npm at the new entry point and set the Node target**

In `server/package.json`, change these three fields:

```json
  "main": "server.js",
  "engines": {
    "node": "24.x"
  },
  "scripts": {
    "start": "node server.js"
  },
```

In `client/package.json`, change only the engines block:

```json
  "engines": {
    "node": "24.x"
  },
```

- [ ] **Step 4: Confirm the deployment doc needs no change**

**Correction (final review):** this step originally assumed `DEPLOYMENT.md` hardcoded `node app.js` as the start command and needed a find-and-replace to `node server.js`. It never did — the documented start command has always been `npm start`, which resolves through `server/package.json`'s `scripts.start`, already repointed at `server.js` in Step 3 above. No edit to `DEPLOYMENT.md` was needed for this task.

- [ ] **Step 5: Verify the server still boots**

You need a real `MONGODB_URI` and `SESSION_SECRET` for this check. From `server/`:

```bash
npm start
```

Expected: `Server running on port:  5000` and no stack trace. Then in a second terminal:

```bash
curl -s localhost:5000/health
```

Expected: `{"status":"ok"}`. Stop the server with Ctrl-C.

- [ ] **Step 6: Commit**

```bash
git add server/app.js server/server.js server/package.json client/package.json
git commit -m "refactor: split server listener from app for testability

Targets Node 24 LTS. app.js now exports the configured app; server.js
owns the listen call. Prerequisite for Supertest."
```

---

## Task 2: Test harness infrastructure

**Files:**
- Create: `server/vitest.config.js`, `server/test/globalSetup.js`, `server/test/setup.js`, `server/test/health.test.js`
- Modify: `server/package.json`

**Interfaces:**
- Consumes: `{ app }` from `server/app.js` (Task 1).
- Produces: a working `npm test`. Every later test file relies on: `MONGODB_URI`, `SESSION_SECRET`, `OMDB_API_KEY`, `CLIENT_ORIGINS` and `NODE_ENV` being set before import; and on `users` and `theaters` being empty at the start of every test.

- [ ] **Step 1: Install the test dependencies**

```bash
npm install --save-dev vitest@^4.1.10 supertest@^7.2.2 mongodb-memory-server@^11.2.0
```

- [ ] **Step 2: Add the test script**

In `server/package.json`, replace the placeholder `test` script:

```json
  "scripts": {
    "start": "node server.js",
    "test": "vitest run",
    "test:watch": "vitest"
  },
```

- [ ] **Step 3: Write the Vitest config**

Create `server/vitest.config.js`:

```javascript
import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        environment: "node",
        include: ["test/**/*.test.js"],
        globalSetup: ["./test/globalSetup.js"],
        setupFiles: ["./test/setup.js"],
        // All test files share one mongod and one "FlixDrive" database,
        // so they must not run concurrently.
        fileParallelism: false,
        testTimeout: 20000,
        hookTimeout: 60000,
    },
});
```

`hookTimeout` is generous because mongodb-memory-server downloads a mongod binary on first run.

- [ ] **Step 4: Write the global setup**

Create `server/test/globalSetup.js`:

```javascript
import { MongoMemoryServer } from "mongodb-memory-server";

let mongod;

export async function setup({ provide }) {
    mongod = await MongoMemoryServer.create();
    provide("mongoUri", mongod.getUri());
}

export async function teardown() {
    await mongod?.stop();
}
```

- [ ] **Step 5: Write the per-worker setup**

This file runs before each test file's imports are evaluated, which is what lets it set `MONGODB_URI` before `createConnection.js` connects.

Create `server/test/setup.js`:

```javascript
import { inject, beforeEach, afterAll } from "vitest";

process.env.MONGODB_URI = inject("mongoUri");
process.env.SESSION_SECRET = "test-session-secret-at-least-32-chars";
process.env.OMDB_API_KEY = "test-omdb-key";
process.env.CLIENT_ORIGINS = "http://localhost:8080";
process.env.NODE_ENV = "test";

// Imported dynamically so the env vars above are set first.
const { default: db, mongoClientPromise } = await import("../database/createConnection.js");

beforeEach(async () => {
    await db.users.deleteMany({});
    await db.theaters.deleteMany({});
});

afterAll(async () => {
    const client = await mongoClientPromise;
    await client.close();
});
```

- [ ] **Step 6: Write the first failing test**

Create `server/test/health.test.js`:

```javascript
import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../app.js";

describe("GET /health", () => {
    it("returns ok", async () => {
        const response = await request(app).get("/health");

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ status: "ok" });
    });
});
```

- [ ] **Step 7: Run it and verify it passes**

```bash
npm test
```

Expected: `1 passed`. First run may take a minute while the mongod binary downloads.

**If it fails with a `MongoServerError` mentioning Stable API or `strict`:** `createConnection.js:11-13` sets `serverApi: { strict: true }`, which the in-memory server may reject. Apply exactly this change to `server/database/createConnection.js`:

```javascript
const client = new MongoClient(mongoUrl, {
  serverApi: process.env.NODE_ENV === "test" ? undefined : {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});
```

**If it hangs after the test passes:** a socket is open. Confirm `afterAll` in `test/setup.js` is closing the client.

- [ ] **Step 8: Commit**

```bash
git add server/vitest.config.js server/test server/package.json server/package-lock.json
git commit -m "test: add Vitest + Supertest harness with in-memory MongoDB"
```

---

## Task 3: Characterize login and logout

**Files:**
- Create: `server/test/helpers.js`, `server/test/login.test.js`

**Interfaces:**
- Consumes: `{ app }` from `../app.js`.
- Produces: `server/test/helpers.js` exporting:
  - `registerUser(overrides?) => Promise<{ username, email, password }>` — inserts a user directly into Mongo with a bcrypt-hashed password and returns the plaintext credentials.
  - `loginAgent(user) => Promise<SuperAgentTest>` — returns a Supertest agent holding a valid session cookie.
  - `seedTheater(overrides?) => Promise<theaterDocument>` — inserts a theater and returns the inserted document including `_id`.
  - `mockOmdb(fetchMock, payload)` — configures a mocked fetch to return `payload` as JSON with `ok: true`.

- [ ] **Step 1: Write the helpers**

Create `server/test/helpers.js`:

```javascript
import bcrypt from "bcrypt";
import request from "supertest";
import { app } from "../app.js";
import db from "../database/createConnection.js";

let counter = 0;

export async function registerUser(overrides = {}) {
    counter += 1;
    const user = {
        username: `user${counter}`,
        email: `user${counter}@example.com`,
        password: "password123",
        ...overrides,
    };

    await db.users.insertOne({
        username: user.username,
        email: user.email.toLowerCase(),
        password: await bcrypt.hash(user.password, 4),
    });

    return user;
}

export async function loginAgent(user) {
    const agent = request.agent(app);
    const response = await agent
        .post("/login")
        .send({ email: user.email, password: user.password });

    if (response.status !== 200) {
        throw new Error(`loginAgent failed: ${response.status} ${JSON.stringify(response.body)}`);
    }

    return agent;
}

export async function seedTheater(overrides = {}) {
    const theater = {
        eventName: "Movie Night",
        startTime: new Date(Date.now() + 3600000),
        timeToClose: new Date(Date.now() + 10800000),
        amountOfSpaces: 10,
        position: 0,
        ownerID: "000000000000000000000001",
        usersInsideTheater: [],
        passwordBool: false,
        password: "",
        imdbID: "tt0000001",
        movieName: "Test Movie",
        movieRuntime: 120,
        ...overrides,
    };

    const result = await db.theaters.insertOne(theater);
    return { ...theater, _id: result.insertedId };
}

export function mockOmdb(fetchMock, payload) {
    fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => payload,
    });
}
```

`bcrypt.hash(..., 4)` uses a low cost factor deliberately — the production code uses 12, which makes test suites crawl.

- [ ] **Step 2: Write the failing tests**

Create `server/test/login.test.js`:

```javascript
import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../app.js";
import { registerUser } from "./helpers.js";

describe("POST /login", () => {
    it("rejects a request with no body", async () => {
        const response = await request(app).post("/login").send({});

        expect(response.status).toBe(400);
        expect(response.body.message).toBe("All fields must be filled");
    });

    it("rejects an unknown email with a generic message", async () => {
        const response = await request(app)
            .post("/login")
            .send({ email: "nobody@example.com", password: "password123" });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe("Email or password incorrect");
    });

    it("rejects a wrong password with the same message", async () => {
        const user = await registerUser();

        const response = await request(app)
            .post("/login")
            .send({ email: user.email, password: "wrong-password" });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe("Email or password incorrect");
    });

    it("logs in, sets a session cookie, and never returns the password hash", async () => {
        const user = await registerUser();

        const response = await request(app)
            .post("/login")
            .send({ email: user.email, password: user.password });

        expect(response.status).toBe(200);
        expect(response.body.data.username).toBe(user.username);
        expect(response.body.data.password).toBeUndefined();
        expect(response.body.data.passwordToken).toBeUndefined();
        expect(response.headers["set-cookie"]).toBeDefined();
    });

    it("matches email case-insensitively", async () => {
        const user = await registerUser({ email: "MixedCase@Example.com" });

        const response = await request(app)
            .post("/login")
            .send({ email: "mixedcase@example.com", password: user.password });

        expect(response.status).toBe(200);
    });
});

describe("GET /logout", () => {
    it("returns 200 even without a session", async () => {
        const response = await request(app).get("/logout");

        expect(response.status).toBe(200);
        expect(response.body.message).toBe("Successfully logged out");
    });
});
```

- [ ] **Step 3: Run and verify they pass**

```bash
npx vitest run test/login.test.js
```

Expected: `6 passed`. These describe existing behaviour, so they pass immediately — that is the point of characterization tests. If any fail, you have found a real discrepancy: stop and report it rather than editing the assertion to match.

- [ ] **Step 4: Commit**

```bash
git add server/test/helpers.js server/test/login.test.js
git commit -m "test: characterize login and logout"
```

---

## Task 4: Characterize signup

**Files:**
- Create: `server/test/users.test.js`

**Interfaces:**
- Consumes: `registerUser` from `./helpers.js`.
- Produces: nothing later tasks depend on.

Signup sends a welcome email via `mailer/mailer.js`. The mailer already swallows its own errors and returns `false`, and `userRouter.js:43` calls it with `void`, so it cannot fail the request — no mocking needed. It will log a delivery failure during the run; that is expected.

- [ ] **Step 1: Write the failing tests**

Create `server/test/users.test.js`:

```javascript
import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../app.js";
import db from "../database/createConnection.js";
import { registerUser } from "./helpers.js";

const validSignup = {
    username: "newuser",
    email: "newuser@example.com",
    password: "password123",
    passwordRepeat: "password123",
};

describe("POST /users", () => {
    it("rejects a request with missing fields", async () => {
        const response = await request(app).post("/users").send({ username: "x" });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe("All fields must be filled");
    });

    it("rejects mismatched passwords", async () => {
        const response = await request(app)
            .post("/users")
            .send({ ...validSignup, passwordRepeat: "different123" });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe("Passwords must match");
    });

    it("rejects a password shorter than 8 characters", async () => {
        const response = await request(app)
            .post("/users")
            .send({ ...validSignup, password: "short", passwordRepeat: "short" });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe("Password must be between 8 and 24 characters");
    });

    it("rejects a malformed email", async () => {
        const response = await request(app)
            .post("/users")
            .send({ ...validSignup, email: "not-an-email" });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe("Email must be valid");
    });

    it("rejects a duplicate username regardless of case", async () => {
        const existing = await registerUser({ username: "Taken" });

        const response = await request(app)
            .post("/users")
            .send({ ...validSignup, username: "taken" });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe("Username already exists");
        expect(existing.username).toBe("Taken");
    });

    it("rejects a duplicate email", async () => {
        const existing = await registerUser();

        const response = await request(app)
            .post("/users")
            .send({ ...validSignup, email: existing.email });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe("Email already exists");
    });

    it("creates a user with a hashed password and lowercased email", async () => {
        const response = await request(app)
            .post("/users")
            .send({ ...validSignup, email: "MixedCase@Example.com" });

        expect(response.status).toBe(200);
        expect(response.body.message).toBe("User created");

        const stored = await db.users.findOne({ username: "newuser" });
        expect(stored.email).toBe("mixedcase@example.com");
        expect(stored.password).not.toBe("password123");
    });

    // DEFECT C1 (roadmap spec §5): userRouter.js:26 compares a string to a
    // number, so `username < 3 || username > 16` is always false and the
    // length rule never fires. A one-character username is accepted today.
    // Phase 2 fixes this and flips this assertion to 400.
    it("accepts a one-character username because length validation is broken", async () => {
        const response = await request(app)
            .post("/users")
            .send({ ...validSignup, username: "x" });

        expect(response.status).toBe(200);
    });
});
```

- [ ] **Step 2: Run and verify they pass**

```bash
npx vitest run test/users.test.js
```

Expected: `8 passed`.

- [ ] **Step 3: Commit**

```bash
git add server/test/users.test.js
git commit -m "test: characterize signup, including the broken username length check"
```

---

## Task 5: Characterize password reset

This is where the two security defects live. Pin them precisely so Phase 2 can prove it fixed them.

**Files:**
- Create: `server/test/passwordReset.test.js`
- Modify: `server/test/helpers.js`

**Interfaces:**
- Consumes: `registerUser` from `./helpers.js`.
- Produces: `helpers.js` gains `uniqueIp()`, returning a distinct dotted-quad string on every call. `loginAgent` uses it internally. Tasks 8 and 9 inherit the benefit through `loginAgent` and need no changes of their own.

### The rate limiter, and why this task needs an extra step

`app.js:107` registers `loginLimiter` between `userRouter` and `loginRouter`, so **every `loginRouter` endpoint** — `/login`, `/logout`, `/forgotpassword`, `/resetpassword` — is capped at 10 requests per 15 minutes per IP. This file makes 11 such requests and would otherwise fail three tests with HTTP 429, including the S1 test that demonstrates the account-takeover path.

`app.js:43` already sets `app.set("trust proxy", 1)`, and `express-rate-limit`'s default key generator uses `req.ip`, which Express derives from `X-Forwarded-For` when trust proxy is enabled. Giving each request its own `X-Forwarded-For` therefore gives it its own rate-limit bucket — **with no change to application code**, which this phase forbids.

Each test file runs in its own worker with its own module registry, so the limiter's in-memory store resets per file. Only within-file request counts matter.

- [ ] **Step 0: Add `uniqueIp` to the helpers and route `loginAgent` through it**

Append to `server/test/helpers.js`:

```javascript
let ipCounter = 0;

export function uniqueIp() {
    ipCounter += 1;
    return `10.0.${Math.floor(ipCounter / 256) % 256}.${ipCounter % 256}`;
}
```

Then change `loginAgent` so its login request carries one:

```javascript
export async function loginAgent(user) {
    const agent = request.agent(app);
    const response = await agent
        .post("/login")
        .set("X-Forwarded-For", uniqueIp())
        .send({ email: user.email, password: user.password });

    if (response.status !== 200) {
        throw new Error(`loginAgent failed: ${response.status} ${JSON.stringify(response.body)}`);
    }

    return agent;
}
```

Only `/login` needs the header here — the theater endpoints Tasks 8 and 9 call afterwards run under `baseLimiter`, which allows 1000 requests per window.

- [ ] **Step 0b: Prove the premise before writing any tests**

Do not skip this. If the assumption is wrong, everything below fails confusingly.

Write a scratch test that fires 15 requests at `POST /login` with a distinct `X-Forwarded-For` on each, and assert none returns 429. Run it, confirm it passes, then delete the scratch file — it is a premise check, not a deliverable. Then repeat it with a *fixed* `X-Forwarded-For` and confirm you DO get 429s after the tenth. Report both outputs.

- [ ] **Step 1: Write the failing tests**

Create `server/test/passwordReset.test.js`:

```javascript
import { describe, it, expect } from "vitest";
import request from "supertest";
import bcrypt from "bcrypt";
import { app } from "../app.js";
import db from "../database/createConnection.js";
import { registerUser, uniqueIp } from "./helpers.js";

// Every request in this file hits loginRouter, which is capped at 10 per
// 15 minutes per IP. Each call gets its own IP, and therefore its own bucket.
const post = (url) => request(app).post(url).set("X-Forwarded-For", uniqueIp());
const patch = (url) => request(app).patch(url).set("X-Forwarded-For", uniqueIp());

async function requestResetToken(user) {
    await post("/forgotpassword").send({ email: user.email });
    const stored = await db.users.findOne({ email: user.email.toLowerCase() });
    return stored.passwordToken;
}

describe("POST /forgotpassword", () => {
    it("rejects a missing email", async () => {
        const response = await post("/forgotpassword").send({});

        expect(response.status).toBe(400);
        expect(response.body.message).toBe("All fields must be filled");
    });

    it("rejects a malformed email", async () => {
        const response = await post("/forgotpassword")
            .send({ email: "not-an-email" });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe("Email must be valid");
    });

    it("does not reveal whether an unknown email exists", async () => {
        const response = await post("/forgotpassword")
            .send({ email: "nobody@example.com" });

        expect(response.status).toBe(200);
        expect(response.body.message).toBe(
            "If this email is tied to a user, an email has been sent to it."
        );
    });

    // DEFECT S2 (roadmap spec §5): loginRouter.js:60 generates only
    // crypto.randomBytes(3) — 6 hex characters — with no expiry and no
    // attempt cap. Phase 2 raises the entropy and adds a TTL.
    it("stores a 6-character hex token with no expiry field", async () => {
        const user = await registerUser();
        const token = await requestResetToken(user);

        expect(token).toMatch(/^[0-9a-f]{6}$/);

        const stored = await db.users.findOne({ email: user.email.toLowerCase() });
        expect(stored.passwordTokenExpiresAt).toBeUndefined();
    });
});

describe("POST /resetpassword", () => {
    it("rejects a missing token", async () => {
        const response = await post("/resetpassword")
            .send({ email: "someone@example.com" });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe("Code must be filled");
    });

    it("rejects an incorrect token", async () => {
        const user = await registerUser();
        await requestResetToken(user);

        const response = await post("/resetpassword")
            .send({ email: user.email, token: "aaaaaa" });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe("Code is invalid");
    });

    it("accepts the correct token", async () => {
        const user = await registerUser();
        const token = await requestResetToken(user);

        const response = await post("/resetpassword")
            .send({ email: user.email, token });

        expect(response.status).toBe(200);
    });
});

describe("PATCH /resetpassword", () => {
    it("rejects mismatched passwords", async () => {
        const user = await registerUser();
        const token = await requestResetToken(user);

        const response = await patch("/resetpassword")
            .send({ email: user.email, token, password: "newpass123", passwordRepeat: "other123" });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe("Passwords must match");
    });

    it("changes the password so the new one works and the old one does not", async () => {
        const user = await registerUser();
        const token = await requestResetToken(user);

        const response = await patch("/resetpassword")
            .send({
                email: user.email,
                token,
                password: "newpassword123",
                passwordRepeat: "newpassword123",
            });

        expect(response.status).toBe(200);

        const stored = await db.users.findOne({ email: user.email.toLowerCase() });
        expect(await bcrypt.compare("newpassword123", stored.password)).toBe(true);
        expect(await bcrypt.compare(user.password, stored.password)).toBe(false);
    });

    // DEFECT S1 (roadmap spec §5): loginRouter.js:109 unsets `passwordtoken`
    // (lowercase t) but the field is written as `passwordToken` at line 61.
    // The token therefore survives use and stays valid forever. Combined with
    // S2's 6-character entropy this is a standing account-takeover path.
    // Phase 2 fixes the casing and this test flips to expect undefined.
    it("leaves the reset token valid after it has been used", async () => {
        const user = await registerUser();
        const token = await requestResetToken(user);

        await patch("/resetpassword").send({
            email: user.email,
            token,
            password: "newpassword123",
            passwordRepeat: "newpassword123",
        });

        const stored = await db.users.findOne({ email: user.email.toLowerCase() });
        expect(stored.passwordToken).toBe(token);

        // And it can be used a second time.
        const reuse = await patch("/resetpassword")
            .send({
                email: user.email,
                token,
                password: "thirdpassword123",
                passwordRepeat: "thirdpassword123",
            });

        expect(reuse.status).toBe(200);
    });
});
```

- [ ] **Step 2: Run and verify they pass**

```bash
npx vitest run test/passwordReset.test.js
```

Expected: `10 passed`. (**Correction, final review:** originally documented as 9; the file as written has 10 `it()` blocks.) The last test passing is the proof that S1 is real.

- [ ] **Step 3: Commit**

```bash
git add server/test/passwordReset.test.js
git commit -m "test: characterize password reset, pinning defects S1 and S2"
```

---

## Task 6: Characterize movie search

**Files:**
- Create: `server/test/movies.test.js`

**Interfaces:**
- Consumes: `{ app }` from `../app.js`.
- Produces: the `vi.mock("node-fetch")` pattern that Task 8 reuses and Task 13 replaces.

`movieRouter.js` imports `fetch` from `node-fetch`, so the mock targets that module. Task 13 changes this to a global-fetch stub.

- [ ] **Step 1: Write the failing tests**

Create `server/test/movies.test.js`:

```javascript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import request from "supertest";
import fetch from "node-fetch";
import { app } from "../app.js";

vi.mock("node-fetch", () => ({ default: vi.fn() }));

describe("GET /movies", () => {
    beforeEach(() => {
        vi.mocked(fetch).mockReset();
        process.env.OMDB_API_KEY = "test-omdb-key";
    });

    afterEach(() => {
        process.env.OMDB_API_KEY = "test-omdb-key";
    });

    it("rejects a missing search term", async () => {
        const response = await request(app).get("/movies");

        expect(response.status).toBe(400);
        expect(response.body.message).toBe("A movie title is required");
        expect(fetch).not.toHaveBeenCalled();
    });

    it("rejects a whitespace-only search term", async () => {
        const response = await request(app).get("/movies?s=%20%20");

        expect(response.status).toBe(400);
        expect(fetch).not.toHaveBeenCalled();
    });

    it("returns 503 when the API key is not configured", async () => {
        delete process.env.OMDB_API_KEY;

        const response = await request(app).get("/movies?s=matrix");

        expect(response.status).toBe(503);
        expect(response.body.message).toBe("Movie search is not configured");
    });

    it("returns provider results on success", async () => {
        const payload = {
            Response: "True",
            Search: [{ Title: "The Matrix", Year: "1999", imdbID: "tt0133093" }],
        };
        vi.mocked(fetch).mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => payload,
        });

        const response = await request(app).get("/movies?s=matrix");

        expect(response.status).toBe(200);
        expect(response.body.data).toEqual(payload);

        const calledUrl = vi.mocked(fetch).mock.calls[0][0];
        expect(calledUrl.toString()).toContain("s=matrix");
        expect(calledUrl.toString()).toContain("apikey=test-omdb-key");
    });

    it("passes through a provider 'no results' response as 200", async () => {
        vi.mocked(fetch).mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ Response: "False", Error: "Movie not found!" }),
        });

        const response = await request(app).get("/movies?s=zzzzzz");

        expect(response.status).toBe(200);
        expect(response.body.data.Response).toBe("False");
    });

    it("returns 502 when the provider errors", async () => {
        vi.mocked(fetch).mockResolvedValue({
            ok: false,
            status: 500,
            json: async () => ({ Error: "Server busy" }),
        });

        const response = await request(app).get("/movies?s=matrix");

        expect(response.status).toBe(502);
        expect(response.body.message).toContain("Movie provider error");
    });

    it("returns 502 when the provider is unreachable", async () => {
        vi.mocked(fetch).mockRejectedValue(new Error("ECONNREFUSED"));

        const response = await request(app).get("/movies?s=matrix");

        expect(response.status).toBe(502);
        expect(response.body.message).toBe("Movie search is temporarily unavailable");
    });
});
```

- [ ] **Step 2: Run and verify they pass**

```bash
npx vitest run test/movies.test.js
```

Expected: `7 passed`, and no outbound network traffic.

- [ ] **Step 3: Commit**

```bash
git add server/test/movies.test.js
git commit -m "test: characterize movie search with OMDB mocked"
```

---

## Task 7: Characterize theater reads

**Files:**
- Create: `server/test/theatersRead.test.js`

**Interfaces:**
- Consumes: `registerUser`, `loginAgent`, `seedTheater` from `./helpers.js`.
- Produces: nothing later tasks depend on.

- [ ] **Step 1: Write the failing tests**

Create `server/test/theatersRead.test.js`:

```javascript
import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../app.js";
import { registerUser, loginAgent, seedTheater } from "./helpers.js";

describe("GET /theaters", () => {
    // DEFECT S8 (roadmap spec §5): this endpoint requires no session and
    // exposes every theater including ownerID. Phase 2 gates it.
    it("is readable without logging in", async () => {
        await seedTheater({ eventName: "Public Night" });

        const response = await request(app).get("/theaters");

        expect(response.status).toBe(200);
        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0].eventName).toBe("Public Night");
        expect(response.body.data[0].ownerID).toBeDefined();
    });

    it("never returns the theater password hash", async () => {
        await seedTheater({ passwordBool: true, password: "$2b$12$fakehashfakehashfake" });

        const response = await request(app).get("/theaters");

        expect(response.body.data[0].password).toBeUndefined();
    });

    it("returns an empty array when there are no theaters", async () => {
        const response = await request(app).get("/theaters");

        expect(response.status).toBe(200);
        expect(response.body.data).toEqual([]);
    });
});

describe("GET /theaters/:id", () => {
    it("requires a session", async () => {
        const theater = await seedTheater();

        const response = await request(app).get(`/theaters/${theater._id}`);

        expect(response.status).toBe(400);
        expect(response.body.message).toBe("Must be logged in");
    });

    it("rejects a malformed id", async () => {
        const user = await registerUser();
        const agent = await loginAgent(user);

        const response = await agent.get("/theaters/not-an-object-id");

        expect(response.status).toBe(400);
        expect(response.body.message).toBe("Invalid theater");
    });

    it("returns 404 for a well-formed id that does not exist", async () => {
        const user = await registerUser();
        const agent = await loginAgent(user);

        const response = await agent.get("/theaters/000000000000000000000099");

        expect(response.status).toBe(404);
        expect(response.body.message).toBe("Theater not found");
    });

    it("returns the theater without its password hash", async () => {
        const user = await registerUser();
        const agent = await loginAgent(user);
        const theater = await seedTheater({
            eventName: "Private Night",
            passwordBool: true,
            password: "$2b$12$fakehashfakehashfake",
        });

        const response = await agent.get(`/theaters/${theater._id}`);

        expect(response.status).toBe(200);
        expect(response.body.data.eventName).toBe("Private Night");
        expect(response.body.data.password).toBeUndefined();
    });
});
```

- [ ] **Step 2: Run and verify they pass**

```bash
npx vitest run test/theatersRead.test.js
```

Expected: `7 passed`.

- [ ] **Step 3: Commit**

```bash
git add server/test/theatersRead.test.js
git commit -m "test: characterize theater reads"
```

---

## Task 8: Characterize theater creation

`POST /theaters` is the most complex route: session gating, an in-session mutex, eight validation rules, an OMDB round trip, and slot allocation.

**Files:**
- Create: `server/test/theatersCreate.test.js`

**Interfaces:**
- Consumes: `registerUser`, `loginAgent`, `seedTheater`, `mockOmdb` from `./helpers.js`; the `vi.mock("node-fetch")` pattern from Task 6.
- Produces: nothing later tasks depend on.

- [ ] **Step 1: Write the failing tests**

Create `server/test/theatersCreate.test.js`:

```javascript
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import fetch from "node-fetch";
import { app } from "../app.js";
import db from "../database/createConnection.js";
import { registerUser, loginAgent, seedTheater, mockOmdb } from "./helpers.js";

vi.mock("node-fetch", () => ({ default: vi.fn() }));

const omdbMovie = {
    Response: "True",
    Title: "The Matrix",
    Year: "1999",
    Runtime: "136 min",
    imdbRating: "8.7",
    Poster: "https://example.com/poster.jpg",
    Plot: "A hacker learns the truth.",
    Genre: "Action, Sci-Fi",
};

function validEvent(overrides = {}) {
    return {
        eventName: "Movie Night",
        startTime: new Date(Date.now() + 3600000).toISOString(),
        amountOfSpaces: 10,
        imdbID: "tt0133093",
        passwordBool: false,
        ...overrides,
    };
}

describe("POST /theaters", () => {
    beforeEach(() => {
        vi.mocked(fetch).mockReset();
        mockOmdb(vi.mocked(fetch), omdbMovie);
    });

    it("requires a session", async () => {
        const response = await request(app).post("/theaters").send({ data: validEvent() });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe("Must be logged in to create a new event");
    });

    it("rejects an event with missing required fields", async () => {
        const agent = await loginAgent(await registerUser());

        const response = await agent.post("/theaters").send({ data: { eventName: "Only a name" } });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe("All fields must be filled");
    });

    it("rejects an event name outside 3-18 characters", async () => {
        const agent = await loginAgent(await registerUser());

        const response = await agent
            .post("/theaters")
            .send({ data: validEvent({ eventName: "ab" }) });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe("Event name must be between 3 and 18 characters");
    });

    it("rejects a seat count above 99", async () => {
        const agent = await loginAgent(await registerUser());

        const response = await agent
            .post("/theaters")
            .send({ data: validEvent({ amountOfSpaces: 100 }) });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe("Amount of spaces must be between 1 and 99");
    });

    it("rejects a start time more than 24 hours out", async () => {
        const agent = await loginAgent(await registerUser());
        const startTime = new Date(Date.now() + 26 * 3600000).toISOString();

        const response = await agent.post("/theaters").send({ data: validEvent({ startTime }) });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe("Time must be within 24 hours");
    });

    it("rejects a short password when passwordBool is set", async () => {
        const agent = await loginAgent(await registerUser());

        const response = await agent
            .post("/theaters")
            .send({ data: validEvent({ passwordBool: true, password: "short" }) });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe("Password must be between 8 and 24 characters");
    });

    it("creates the theater and enriches it from OMDB", async () => {
        const agent = await loginAgent(await registerUser());

        const response = await agent.post("/theaters").send({ data: validEvent() });

        expect(response.status).toBe(200);
        expect(response.body.message).toBe("Event Created");

        const stored = await db.theaters.findOne({ eventName: "Movie Night" });
        expect(stored.movieName).toBe("The Matrix");
        expect(stored.movieRuntime).toBe(136);
        expect(stored.movieReleaseYear).toBe("1999");
        expect(stored.usersInsideTheater).toEqual([]);
        expect(stored.position).toBe(0);
    });

    it("hashes the theater password when one is set", async () => {
        const agent = await loginAgent(await registerUser());

        await agent
            .post("/theaters")
            .send({ data: validEvent({ passwordBool: true, password: "lobbypassword" }) });

        const stored = await db.theaters.findOne({ eventName: "Movie Night" });
        expect(stored.password).not.toBe("lobbypassword");
        expect(stored.password.startsWith("$2")).toBe(true);
    });

    it("allows only one live event per owner", async () => {
        const user = await registerUser();
        const agent = await loginAgent(user);
        await agent.post("/theaters").send({ data: validEvent() });

        const response = await agent
            .post("/theaters")
            .send({ data: validEvent({ eventName: "Second Night" }) });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe("You already have an ongoing event");
    });

    it("returns 502 when OMDB is unreachable", async () => {
        const agent = await loginAgent(await registerUser());
        vi.mocked(fetch).mockRejectedValue(new Error("ECONNREFUSED"));

        const response = await agent.post("/theaters").send({ data: validEvent() });

        expect(response.status).toBe(502);
        expect(response.body.message).toBe("Movie details are temporarily unavailable");
    });

    it("assigns the next free slot when one is already taken", async () => {
        await seedTheater({ position: 0, eventName: "Existing" });
        const agent = await loginAgent(await registerUser());

        const response = await agent.post("/theaters").send({ data: validEvent() });

        expect(response.status).toBe(200);
        const stored = await db.theaters.findOne({ eventName: "Movie Night" });
        expect(stored.position).toBe(1);
    });
});
```

- [ ] **Step 2: Run and verify they pass**

```bash
npx vitest run test/theatersCreate.test.js
```

Expected: `11 passed`. If the last test reports `position: 0` rather than `1`, you have hit defect C3 (the slot allocation loop). Do not fix it — change the assertion to match observed behaviour, add a comment naming C3, and note it in your task report.

- [ ] **Step 3: Commit**

```bash
git add server/test/theatersCreate.test.js
git commit -m "test: characterize theater creation"
```

---

## Task 9: Characterize theater join and delete

**Files:**
- Create: `server/test/theatersJoinDelete.test.js`

**Interfaces:**
- Consumes: `registerUser`, `loginAgent`, `seedTheater` from `./helpers.js`.
- Produces: nothing later tasks depend on.

The join route reads the caller's id from `req.session.userID`, so the agent must be logged in and the body's `userID` must match it. To get the session user id, read the user document back from Mongo after registering.

- [ ] **Step 1: Write the failing tests**

Create `server/test/theatersJoinDelete.test.js`:

```javascript
import { describe, it, expect } from "vitest";
import request from "supertest";
import bcrypt from "bcrypt";
import { app } from "../app.js";
import db from "../database/createConnection.js";
import { registerUser, loginAgent, seedTheater } from "./helpers.js";

async function loggedInUser() {
    const user = await registerUser();
    const agent = await loginAgent(user);
    const stored = await db.users.findOne({ email: user.email.toLowerCase() });
    return { agent, userID: stored._id.toString() };
}

describe("PATCH /theaters/:id", () => {
    it("rejects a malformed id", async () => {
        const { agent, userID } = await loggedInUser();

        const response = await agent
            .patch("/theaters/not-an-object-id")
            .send({ joining: true, userID });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe("Invalid theater");
    });

    it("rejects joining without a session", async () => {
        const theater = await seedTheater();

        const response = await request(app)
            .patch(`/theaters/${theater._id}`)
            .send({ joining: true, userID: "000000000000000000000001" });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe("Must be logged in to join theater");
    });

    it("rejects a body userID that does not match the session", async () => {
        const { agent } = await loggedInUser();
        const theater = await seedTheater();

        const response = await agent
            .patch(`/theaters/${theater._id}`)
            .send({ joining: true, userID: "000000000000000000000002" });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe("Must be logged in to join theater");
    });

    it("joins an open theater and records the occupant", async () => {
        const { agent, userID } = await loggedInUser();
        const theater = await seedTheater();

        const response = await agent
            .patch(`/theaters/${theater._id}`)
            .send({ joining: true, userID });

        expect(response.status).toBe(200);
        expect(response.body.message).toBe("Successfully joined lobby");

        const stored = await db.theaters.findOne({ _id: theater._id });
        expect(stored.usersInsideTheater).toEqual([userID]);
    });

    it("rejects a wrong lobby password", async () => {
        const { agent, userID } = await loggedInUser();
        const theater = await seedTheater({
            passwordBool: true,
            password: await bcrypt.hash("correct-password", 4),
        });

        const response = await agent
            .patch(`/theaters/${theater._id}`)
            .send({ joining: true, userID, password: "wrong-password" });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe("Password doesn't match");
    });

    it("accepts the correct lobby password", async () => {
        const { agent, userID } = await loggedInUser();
        const theater = await seedTheater({
            passwordBool: true,
            password: await bcrypt.hash("correct-password", 4),
        });

        const response = await agent
            .patch(`/theaters/${theater._id}`)
            .send({ joining: true, userID, password: "correct-password" });

        expect(response.status).toBe(200);
    });

    it("rejects joining a full theater", async () => {
        const { agent, userID } = await loggedInUser();
        const theater = await seedTheater({
            amountOfSpaces: 1,
            usersInsideTheater: ["000000000000000000000003"],
        });

        const response = await agent
            .patch(`/theaters/${theater._id}`)
            .send({ joining: true, userID });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe("Theater is full");
    });

    it("rejects joining twice", async () => {
        const { agent, userID } = await loggedInUser();
        const theater = await seedTheater({ usersInsideTheater: [] });
        await agent.patch(`/theaters/${theater._id}`).send({ joining: true, userID });

        const response = await agent
            .patch(`/theaters/${theater._id}`)
            .send({ joining: true, userID });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe("You are already inside the theater");
    });

    it("rejects an update that is not a join", async () => {
        const { agent } = await loggedInUser();
        const theater = await seedTheater();

        const response = await agent
            .patch(`/theaters/${theater._id}`)
            .send({ eventName: "Renamed" });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe("Unsupported theater update");
    });
});

describe("DELETE /theaters/:id", () => {
    it("rejects deletion by a non-owner", async () => {
        const { agent } = await loggedInUser();
        const theater = await seedTheater({ ownerID: "000000000000000000000004" });

        const response = await agent.delete(`/theaters/${theater._id}`);

        expect(response.status).toBe(400);
        expect(response.body.message).toBe("Only the owner can delete the theater");
    });

    it("rejects deletion when the owner is not the sole occupant", async () => {
        const { agent, userID } = await loggedInUser();
        const theater = await seedTheater({
            ownerID: userID,
            usersInsideTheater: [userID, "000000000000000000000005"],
        });

        const response = await agent.delete(`/theaters/${theater._id}`);

        expect(response.status).toBe(400);
        expect(response.body.message).toBe("Owner must be the only one inside the theater");
    });

    it("deletes when the owner is alone inside", async () => {
        const { agent, userID } = await loggedInUser();
        const theater = await seedTheater({ ownerID: userID, usersInsideTheater: [userID] });

        const response = await agent.delete(`/theaters/${theater._id}`);

        expect(response.status).toBe(200);
        expect(response.body.message).toBe("Theater successfully deleted");

        const stored = await db.theaters.findOne({ _id: theater._id });
        expect(stored).toBeNull();
    });
});
```

- [ ] **Step 2: Run the whole suite**

```bash
npm test
```

Expected: all files pass, 62 tests total. (**Correction, final review:** originally documented as 61; `passwordReset.test.js` has 10 tests, not 9, so the running total from Task 5 onward was off by one.)

- [ ] **Step 3: Commit**

```bash
git add server/test/theatersJoinDelete.test.js
git commit -m "test: characterize theater join and delete"
```

---

## Task 10: Continuous integration

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: `npm test` in `server/` (Task 2).
- Produces: a required status check for every later PR in Phase 0.

- [ ] **Step 1: Write the workflow**

Create `.github/workflows/ci.yml` at the repository root:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  server:
    name: Server tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
          cache-dependency-path: server/package-lock.json
      - name: Cache mongodb-memory-server binaries
        uses: actions/cache@v4
        with:
          path: ~/.cache/mongodb-binaries
          key: mongodb-binaries-${{ runner.os }}
      - run: npm ci
        working-directory: server
      - run: npm test
        working-directory: server

  client:
    name: Client build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
          cache-dependency-path: client/package-lock.json
      - run: npm ci
        working-directory: client
      - run: npm run build
        working-directory: client
        env:
          API_URL: http://localhost:5000
```

The binary cache matters: without it every run re-downloads a mongod, adding a minute or more.

- [ ] **Step 2: Push and confirm the workflow runs green**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: run server tests and client build on every PR"
git push -u origin HEAD
```

Then check the run:

```bash
gh run watch
```

Expected: both jobs green. If the server job fails on the mongod download, re-run once — the cache is cold on the first run.

- [ ] **Step 3: Make the checks required**

In the GitHub UI: Settings → Branches → add a branch protection rule for `main` requiring the `Server tests` and `Client build` checks. This cannot be done from the CLI without admin API calls; do it manually and confirm.

---

## Task 11: Upgrade to Express 5

The safety net is now in place. This is the upgrade with real breaking changes.

**Files:**
- Modify: `server/package.json`, `server/app.js`

**Interfaces:**
- Consumes: the full test suite from Tasks 2–9.
- Produces: an error-handling middleware at the end of the stack. Later phases add structured logging inside it.

Two documented Express 5 changes affect this codebase:

1. **Bare `*` route paths are invalid.** Wildcards must be named. `/*splat` matches one or more segments; `/{*splat}` also matches zero, which is what an SPA fallback needs so that `/` still resolves.
2. **Rejected promises returned from handlers are forwarded to the error handler automatically.** This only helps if an error handler exists, so we add one.

- [ ] **Step 1: Run the suite and record the baseline**

```bash
npm test
```

Expected: all green. Note the test count — it must not change in this task.

- [ ] **Step 2: Install Express 5**

```bash
npm install express@^5.2.1
```

- [ ] **Step 3: Run the suite to see what breaks**

```bash
npm test
```

Expected: **failures**, or a boot-time `TypeError` from `path-to-regexp` about a missing parameter name. This is the wildcard route. Record what you see before fixing it.

- [ ] **Step 4: Fix the wildcard route**

In `server/app.js`, replace the SPA fallback at line 115:

```javascript
    app.get("*", (req, res) => {
        res.sendFile(path.join(clientPublicDirectory, "index.html"));
    });
```

with:

```javascript
    app.get("/{*splat}", (req, res) => {
        res.sendFile(path.join(clientPublicDirectory, "index.html"));
    });
```

The braces make the wildcard match zero segments too, so `/` still serves `index.html`.

- [ ] **Step 5: Add a test-only throwing route, then the error handler**

Order matters here. Express searches *forward* from the point of failure for a four-argument handler, so a route registered after the error handler can never reach it. The throwing route must therefore be registered before it, which means it lives in `app.js` behind an env guard rather than in the test file.

In `server/app.js`, immediately after the `if (process.env.SERVE_CLIENT === "true") { ... } else { ... }` block and before `export { app, server, io };`, add both of these, in this order:

```javascript
if (process.env.NODE_ENV === "test") {
    app.get("/__test_async_boom", async () => {
        throw new Error("boom");
    });
}

app.use((err, req, res, next) => {
    console.error("Unhandled request error", {
        method: req.method,
        path: req.path,
        message: err.message,
    });

    if (res.headersSent) {
        return next(err);
    }

    res.status(500).send({ message: "Something went wrong" });
});
```

An Express error handler must take exactly four parameters — dropping `next` silently turns it into ordinary middleware and the handler is never called.

- [ ] **Step 6: Add a test proving async errors are now caught**

Append to `server/test/health.test.js`:

```javascript
describe("error handling", () => {
    it("returns a JSON 500 rather than hanging when a handler rejects", async () => {
        const response = await request(app).get("/__test_async_boom");

        expect(response.status).toBe(500);
        expect(response.body.message).toBe("Something went wrong");
    });
});
```

If this returns 500 with an empty body instead, the error reached Express's built-in handler rather than yours — check that your handler is registered *after* the throwing route and has all four parameters.

- [ ] **Step 7: Run the suite and verify everything passes**

```bash
npm test
```

Expected: the original count plus one, all green.

- [ ] **Step 8: Verify the SPA fallback by hand**

```bash
SERVE_CLIENT=true npm start
```

In another terminal:

```bash
curl -s -o /dev/null -w "%{http_code}\n" localhost:5000/
curl -s -o /dev/null -w "%{http_code}\n" localhost:5000/theaters/abc
```

Expected: `200` for both. Stop the server.

- [ ] **Step 9: Commit**

```bash
git add server/package.json server/package-lock.json server/app.js server/test/health.test.js
git commit -m "feat: upgrade to Express 5

Named the SPA wildcard route (bare '*' is invalid in Express 5) and added
an error-handling middleware, which Express 5 now reaches automatically
for rejected promises returned from handlers."
```

---

## Task 12: Upgrade mongodb and express-rate-limit

**Files:**
- Modify: `server/package.json`, `server/app.js:65-76`

**Interfaces:**
- Consumes: the full test suite.
- Produces: no interface changes.

`express-rate-limit` v8 documents the option as `limit`; the code uses the older `max`. The driver upgrade touches only `find`, `findOne`, `insertOne`, `updateOne`, `deleteOne`, `deleteMany`, `collation` and `ObjectId` — all stable across 6→7. `mongodb@7` requires Node ≥20.19.0, which Node 24 satisfies.

- [ ] **Step 1: Upgrade both packages**

```bash
npm install mongodb@^7.5.0 express-rate-limit@^8.6.2
```

- [ ] **Step 2: Run the suite to see what breaks**

```bash
npm test
```

Record any failures before changing code.

- [ ] **Step 3: Rename the rate-limit option**

In `server/app.js`, replace lines 65–76:

```javascript
const baseLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
	max: 1000,
	standardHeaders: true,
	legacyHeaders: false,
});
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
	max: 10,
	standardHeaders: true,
	legacyHeaders: false,
});
```

with:

```javascript
const baseLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 1000,
    standardHeaders: true,
    legacyHeaders: false,
});
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
});
```

- [ ] **Step 4: Add a test pinning the rate-limit headers**

Append to `server/test/health.test.js`:

```javascript
describe("rate limiting", () => {
    it("sends standard RateLimit headers", async () => {
        const response = await request(app).get("/health");

        expect(response.headers["ratelimit-limit"] ?? response.headers["ratelimit"]).toBeDefined();
        expect(response.headers["x-ratelimit-limit"]).toBeUndefined();
    });
});
```

v8 may emit either the draft-7 combined `RateLimit` header or the older `RateLimit-Limit`; accepting either keeps this test about the thing that matters, which is that `legacyHeaders: false` still suppresses the `X-` variants.

- [ ] **Step 5: Run the suite**

```bash
npm test
```

Expected: all green.

- [ ] **Step 6: Verify a real connection still works**

With a real `MONGODB_URI`:

```bash
npm start
```

Expected: boots with no driver deprecation warnings. Stop the server.

- [ ] **Step 7: Commit**

```bash
git add server/package.json server/package-lock.json server/app.js server/test/health.test.js
git commit -m "feat: upgrade mongodb driver to 7 and express-rate-limit to 8

Renames the deprecated 'max' option to 'limit'."
```

---

## Task 13: Remove node-fetch

Node 24 has a global `fetch`. The dependency is dead weight.

**Files:**
- Modify: `server/routers/movieRouter.js:2`, `server/routers/theaterRouter.js:4`, `server/package.json`, `server/test/movies.test.js`, `server/test/theatersCreate.test.js`

**Interfaces:**
- Consumes: the movie and theater-creation test suites.
- Produces: tests now stub `globalThis.fetch` via `vi.stubGlobal` instead of mocking the `node-fetch` module. Any future test that needs to intercept an outbound HTTP call uses this pattern.

- [ ] **Step 1: Switch the movie tests to a global fetch stub**

In `server/test/movies.test.js`, delete these two lines:

```javascript
import fetch from "node-fetch";
```

```javascript
vi.mock("node-fetch", () => ({ default: vi.fn() }));
```

Add a module-level mock and stub it in `beforeEach`. Replace the `beforeEach`/`afterEach` block with:

```javascript
const fetchMock = vi.fn();

describe("GET /movies", () => {
    beforeEach(() => {
        fetchMock.mockReset();
        vi.stubGlobal("fetch", fetchMock);
        process.env.OMDB_API_KEY = "test-omdb-key";
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        process.env.OMDB_API_KEY = "test-omdb-key";
    });
```

Then replace every `vi.mocked(fetch)` in the file with `fetchMock`, and every bare `expect(fetch)` with `expect(fetchMock)`.

- [ ] **Step 2: Switch the theater-creation tests the same way**

In `server/test/theatersCreate.test.js`, delete the `import fetch from "node-fetch";` line and the `vi.mock("node-fetch", ...)` line, then add above the `describe`:

```javascript
const fetchMock = vi.fn();
```

and replace the `beforeEach` with:

```javascript
    beforeEach(() => {
        fetchMock.mockReset();
        vi.stubGlobal("fetch", fetchMock);
        mockOmdb(fetchMock, omdbMovie);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });
```

Add `afterEach` to the import from `vitest`, and replace every `vi.mocked(fetch)` with `fetchMock`.

- [ ] **Step 3: Run the tests and verify they fail**

```bash
npx vitest run test/movies.test.js test/theatersCreate.test.js
```

Expected: **failures.** The routers still import `node-fetch`, so the global stub is not what they call. This is the correct red state.

**Note (final review):** at this exact step, `vi.stubGlobal("fetch", fetchMock)` stubs `globalThis.fetch`, but the routers still call the real `node-fetch` package, which is unmocked here (its own `vi.mock("node-fetch", ...)` was deleted in Step 1/2 above). Running this command therefore dispatches real HTTP requests to the live OMDB API using the fake `test-omdb-key`, for the few seconds this step takes. This is a knowing, deliberate exception to this plan's own "no network calls in tests" global constraint, scoped to a single red-state verification step that is never run again once Step 4 lands. The same shape — a real external call made once, on purpose, to prove a red state before the fix that makes it unnecessary — will recur in later phases.

- [ ] **Step 4: Drop the import from both routers**

In `server/routers/movieRouter.js`, delete line 2:

```javascript
import fetch from "node-fetch";
```

In `server/routers/theaterRouter.js`, delete line 4:

```javascript
import fetch from "node-fetch";
```

No call sites change — the global `fetch` has the same signature for the way it is used here.

- [ ] **Step 5: Run the tests and verify they pass**

```bash
npx vitest run test/movies.test.js test/theatersCreate.test.js
```

Expected: all green.

- [ ] **Step 6: Uninstall the package and run the full suite**

```bash
npm uninstall node-fetch
npm test
```

Expected: all green, and `node-fetch` gone from `server/package.json`.

- [ ] **Step 7: Confirm nothing else references it**

```bash
grep -rn "node-fetch" server --exclude-dir=node_modules
```

Expected: no output.

- [ ] **Step 8: Commit**

```bash
git add server/package.json server/package-lock.json server/routers/movieRouter.js server/routers/theaterRouter.js server/test/movies.test.js server/test/theatersCreate.test.js
git commit -m "refactor: use Node's global fetch instead of node-fetch"
```

---

## Done criteria

- `npm test` in `server/` runs 67 tests green. (**Correction, final review:** originally documented as 63. The correct count at the end of Task 13 was 64 — `passwordReset.test.js` has 10 tests, not 9, the same off-by-one that affected the Task 9 checkpoint above. The number is 67, not 64, because it also reflects the final whole-branch review's fix wave — outside this plan's own tasks — which added a malformed-JSON-body test, a rate-limiter 429 test, and a characterization test for defect S9. Verified by running `npm test` after that fix wave.)
- CI is green on a PR and both checks are required on `main`.
- `server/package.json` has no dependency more than one major version behind: `express@5`, `mongodb@7`, `express-rate-limit@8`, no `node-fetch`.
- Both `package.json` files declare `engines.node: "24.x"`.
- The server boots with `npm start` and serves the SPA fallback when `SERVE_CLIENT=true`.
- Defects S1, S2, S8 and C1 are each pinned by a test carrying its defect ID in a comment, so Phase 2 has an executable definition of "fixed". (S9 is also now pinned, added by the final review's fix wave.)

## Deviations from the spec

**CI is pulled forward from Phase 1.** The roadmap spec puts GitHub Actions in Phase 1, but Tasks 11–13 are upgrades whose entire safety argument rests on the suite actually running on every change. Task 10 therefore sets up test and build jobs now. **Linting and formatting stay in Phase 1** — the `lint` job gets added to this same workflow there.

## Not in this plan

Steps 0.3 (SVG extraction), 0.4 (Vite + throwaway router), 0.5 (Svelte 5 runes) and 0.6 (SvelteKit) are the client track and get their own plans. Nothing here touches `client/src`.
