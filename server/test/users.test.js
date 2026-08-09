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
