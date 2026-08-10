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

    // DEFECT C1 (roadmap spec §5): userRouter.js compared a string to a number,
    // so `username < 3 || username > 16` was always false and the length rule
    // never fired. Every boundary is asserted because the fix reintroduces the
    // comparison that was silently absent.
    describe("username length", () => {
        it.each([
            ["x", 400],
            ["ab", 400],
            ["abc", 200],
            ["a".repeat(16), 200],
            ["a".repeat(17), 400],
        ])("username %s is answered with %i", async (username, expected) => {
            const response = await request(app)
                .post("/users")
                .send({ ...validSignup, username });

            expect(response.status).toBe(expected);
        });

        it("explains the rule when the username is too short", async () => {
            const response = await request(app)
                .post("/users")
                .send({ ...validSignup, username: "ab" });

            expect(response.body.message).toBe("Username must be between 3 and 16 characters");
        });
    });

    // DEFECT N2 (roadmap spec §5): mongo-sanitize neutralises an operator into
    // `{}` rather than rejecting it, so once the sanitizer went live a
    // `username: {"$ne": null}` stopped being caught by the duplicate check and
    // instead created a user with `username: {}`, which then went into the
    // session. Scrubbing is the wrong control; the fields must be typed.
    it("rejects a non-string username instead of storing an empty object", async () => {
        const response = await request(app)
            .post("/users")
            .send({ ...validSignup, username: { $ne: null } });

        expect(response.status).toBe(400);

        const stored = await db.users.findOne({ email: validSignup.email });
        expect(stored).toBeNull();
    });

    it("rejects a non-string email", async () => {
        const response = await request(app)
            .post("/users")
            .send({ ...validSignup, email: { $ne: null } });

        expect(response.status).toBe(400);
    });
});
