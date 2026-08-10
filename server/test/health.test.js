import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../app.js";

describe("GET /health", () => {
    it("reports the database as reachable", async () => {
        const response = await request(app).get("/health");

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ status: "ok", mongo: "ok" });
    });
});

describe("error handling", () => {
    it("returns a JSON 500 rather than hanging when a handler rejects", async () => {
        const response = await request(app).get("/__test_async_boom");

        expect(response.status).toBe(500);
        expect(response.body.message).toBe("Something went wrong");
    });
});

describe("malformed request body", () => {
    // FIX 3 (final review): the error handler used to hardcode res.status(500),
    // flattening body-parser's own 400/413 statuses to 500. body-parser sets
    // err.status on a JSON parse failure; the handler now honours it.
    it("returns 400, not 500, for a body express.json() cannot parse", async () => {
        const response = await request(app)
            .post("/login")
            .set("Content-Type", "application/json")
            .send('{"broken"');

        expect(response.status).toBe(400);
    });
});

describe("rate limiting", () => {
    it("sends standard RateLimit headers", async () => {
        const response = await request(app).get("/health");

        expect(response.headers["ratelimit-limit"] ?? response.headers["ratelimit"]).toBeDefined();
        expect(response.headers["x-ratelimit-limit"]).toBeUndefined();
    });

    // FIX 4 (final review): the only prior rate-limit test checked header
    // presence, which cannot distinguish express-rate-limit v6 from v8 and
    // never asserts a 429. This IP is well outside the 10.0.x.x range
    // uniqueIp() (helpers.js) generates, so it cannot collide with it.
    it("blocks the 11th login attempt from one IP", async () => {
        const ip = "10.255.0.1";
        for (let i = 0; i < 10; i++) {
            await request(app).post("/login").set("X-Forwarded-For", ip).send({});
        }
        const response = await request(app).post("/login").set("X-Forwarded-For", ip).send({});

        expect(response.status).toBe(429);
    });

    // DEFECT O6 (roadmap spec §5): `app.use(loginLimiter)` was path-less and
    // registered ahead of the 404 handler, so anything that fell through
    // routing — every unknown path — spent the login bucket. Ten stray 404s
    // from one NAT'd IP locked every user behind it out of /login for 15
    // minutes. These IPs are outside the 10.0.x.x range uniqueIp() generates.
    it("does not spend the login bucket on requests to unknown paths", async () => {
        const ip = "10.255.0.2";
        for (let i = 0; i < 20; i++) {
            await request(app).get(`/no-such-path-${i}`).set("X-Forwarded-For", ip);
        }
        const response = await request(app).post("/login").set("X-Forwarded-For", ip).send({});

        expect(response.status).not.toBe(429);
    });

    // The scoping is a path list, so it can silently lose a path. Both reset
    // endpoints are credential-guessing surfaces and must stay covered.
    it.each(["/forgotpassword", "/resetpassword"])("still rate limits %s", async (path) => {
        const ip = `10.254.0.${path.length}`;
        for (let i = 0; i < 10; i++) {
            await request(app).post(path).set("X-Forwarded-For", ip).send({});
        }
        const response = await request(app).post(path).set("X-Forwarded-For", ip).send({});

        expect(response.status).toBe(429);
    });

    it("does not spend the login bucket on ordinary API reads", async () => {
        const ip = "10.255.0.3";
        for (let i = 0; i < 20; i++) {
            await request(app).get("/theaters").set("X-Forwarded-For", ip);
        }
        const response = await request(app).post("/login").set("X-Forwarded-For", ip).send({});

        expect(response.status).not.toBe(429);
    });
});

// DEFECT N1 (roadmap spec §5): mongo-sanitize recurses without a depth limit,
// so a deeply nested body — 20 kB, well under body-parser's 100 kB default —
// overflowed the stack. Express 5 caught the synchronous throw, so the process
// survived, but an unauthenticated request that should be a 400 became a 500.
// Introduced by moving the sanitizer after express.json(), which made it live.
// Measured: depth 2,000 was fine; depth 10,000 produced the 500.
describe("deeply nested request bodies", () => {
    it("rejects a body nested past the sanitizer's depth limit", async () => {
        const depth = 10000;
        const body = "[".repeat(depth) + "1" + "]".repeat(depth);

        const response = await request(app)
            .post("/login")
            .set("X-Forwarded-For", "10.254.0.1")
            .set("Content-Type", "application/json")
            .send(body);

        expect(response.status).toBe(400);
    });

    it("still accepts a normally nested body", async () => {
        const depth = 20;
        const body = "[".repeat(depth) + "1" + "]".repeat(depth);

        const response = await request(app)
            .post("/login")
            .set("X-Forwarded-For", "10.254.0.2")
            .set("Content-Type", "application/json")
            .send(body);

        // Reaches the route and is rejected on its merits, not by the guard.
        expect(response.status).toBe(400);
        expect(response.body.message).toBe("All fields must be filled");
    });
});
