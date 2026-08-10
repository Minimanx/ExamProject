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
});
