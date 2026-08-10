import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../app.js";
import { registerUser, uniqueIp } from "./helpers.js";

// Every request in this file hits loginRouter, which is capped at 10 per
// 15 minutes per IP. Each call gets its own IP, and therefore its own
// bucket, the same way server/test/passwordReset.test.js already does —
// otherwise the fifth login test anyone adds here turns the file red with
// a puzzling 429.
const post = (url) => request(app).post(url).set("X-Forwarded-For", uniqueIp());
const get = (url) => request(app).get(url).set("X-Forwarded-For", uniqueIp());

describe("POST /login", () => {
    it("rejects a request with no body", async () => {
        const response = await post("/login").send({});

        expect(response.status).toBe(400);
        expect(response.body.message).toBe("All fields must be filled");
    });

    it("rejects an unknown email with a generic message", async () => {
        const response = await post("/login").send({
            email: "nobody@example.com",
            password: "password123",
        });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe("Email or password incorrect");
    });

    it("rejects a wrong password with the same message", async () => {
        const user = await registerUser();

        const response = await post("/login").send({
            email: user.email,
            password: "wrong-password",
        });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe("Email or password incorrect");
    });

    it("logs in, sets a session cookie, and never returns the password hash", async () => {
        const user = await registerUser();

        const response = await post("/login").send({ email: user.email, password: user.password });

        expect(response.status).toBe(200);
        expect(response.body.data.username).toBe(user.username);
        expect(response.body.data.password).toBeUndefined();
        expect(response.body.data.passwordToken).toBeUndefined();
        expect(response.headers["set-cookie"]).toBeDefined();
    });

    it("matches email case-insensitively", async () => {
        const user = await registerUser();

        const response = await post("/login").send({
            email: user.email.toUpperCase(),
            password: user.password,
        });

        expect(response.status).toBe(200);
    });
});

describe("GET /logout", () => {
    it("returns 200 even without a session", async () => {
        const response = await get("/logout");

        expect(response.status).toBe(200);
        expect(response.body.message).toBe("Successfully logged out");
    });
});
