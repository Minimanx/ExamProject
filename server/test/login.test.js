import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../app.js";
import { registerUser, loginAgent, uniqueIp } from "./helpers.js";

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

        expect(response.status).toBe(401);
        expect(response.body.message).toBe("Email or password incorrect");
    });

    it("rejects a wrong password with the same message", async () => {
        const user = await registerUser();

        const response = await post("/login").send({
            email: user.email,
            password: "wrong-password",
        });

        expect(response.status).toBe(401);
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

// The client keeps "am I logged in" in localStorage, which outlives the server
// session it describes — a restart, an expiry, a logout in another tab. Until
// now nothing could tell it otherwise, so it would render the whole world for
// somebody the server does not know: driving around, typing into a chat that
// goes nowhere, invisible to everyone.
describe("GET /me", () => {
    it("says who you are", async () => {
        const user = await registerUser();
        const agent = await loginAgent(user);

        const response = await agent.get("/me");

        expect(response.status).toBe(200);
        expect(response.body.data.username).toBe(user.username);
        expect(response.body.data._id).toBeTruthy();
    });

    it("answers 401 when there is no session, so the client can act on it", async () => {
        const response = await get("/me");

        expect(response.status).toBe(401);
        expect(response.body.code).toBe("UNAUTHENTICATED");
    });

    it("answers 401 once you have logged out", async () => {
        const user = await registerUser();
        const agent = await loginAgent(user);
        await agent.get("/logout");

        const response = await agent.get("/me");

        expect(response.status).toBe(401);
    });

    // The client stores this and shows it; nothing needs the address.
    it("does not include the email or the password", async () => {
        const user = await registerUser();
        const agent = await loginAgent(user);

        const response = await agent.get("/me");

        expect(JSON.stringify(response.body)).not.toContain(user.email);
        expect(response.body.data.password).toBeUndefined();
    });
});
