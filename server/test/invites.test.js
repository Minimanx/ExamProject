import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import { app } from "../app.js";
import db from "../database/createConnection.js";

// Roadmap §3, hedge 1: "features first" does not have to mean "strangers
// first". Registration can be closed behind one flag until Phase 9's trust and
// safety work lands, and the cost of having the switch is one boolean.
//
// The flag is read per request rather than at boot so it can be flipped without
// a deploy — closing registration is the kind of thing wanted in a hurry.
describe("invite-only registration", () => {
    const signup = {
        email: "invited@example.com",
        username: "invitedone",
        password: "password123",
        passwordRepeat: "password123",
    };

    beforeEach(async () => {
        await db.invites.deleteMany({});
        process.env.INVITE_ONLY = "true";
    });

    afterEach(() => {
        delete process.env.INVITE_ONLY;
    });

    async function seedInvite(code, overrides = {}) {
        await db.invites.insertOne({
            code,
            createdAt: new Date(),
            usedAt: null,
            usedBy: null,
            ...overrides,
        });
    }

    it("turns away a signup with no invite code", async () => {
        const response = await request(app).post("/users").send(signup);

        expect(response.status).toBe(403);
        expect(response.body.code).toBe("FORBIDDEN");
        expect(response.body.message).toBe("Registration is invite only");
    });

    it("turns away a signup with an unknown code", async () => {
        const response = await request(app)
            .post("/users")
            .send({ ...signup, inviteCode: "not-a-real-code" });

        expect(response.status).toBe(403);

        const stored = await db.users.findOne({ email: signup.email });
        expect(stored).toBeNull();
    });

    it("accepts a signup with a valid code", async () => {
        await seedInvite("GOLDENTICKET");

        const response = await request(app)
            .post("/users")
            .send({ ...signup, inviteCode: "GOLDENTICKET" });

        expect(response.status).toBe(200);
    });

    it("marks the code used, naming who used it", async () => {
        await seedInvite("GOLDENTICKET");

        await request(app)
            .post("/users")
            .send({ ...signup, inviteCode: "GOLDENTICKET" });

        const invite = await db.invites.findOne({ code: "GOLDENTICKET" });
        const user = await db.users.findOne({ email: signup.email });
        expect(invite.usedAt).toBeInstanceOf(Date);
        expect(invite.usedBy).toBe(user._id.toString());
    });

    it("refuses a code that has already been used", async () => {
        await seedInvite("GOLDENTICKET", { usedAt: new Date(), usedBy: "someone" });

        const response = await request(app)
            .post("/users")
            .send({ ...signup, inviteCode: "GOLDENTICKET" });

        expect(response.status).toBe(403);
    });

    // Two people racing on one code is the case a check-then-write loses. The
    // claim is one signup, not one error message.
    it("lets only one of two simultaneous signups spend the same code", async () => {
        await seedInvite("GOLDENTICKET");

        const responses = await Promise.all([
            request(app)
                .post("/users")
                .send({ ...signup, inviteCode: "GOLDENTICKET" }),
            request(app)
                .post("/users")
                .send({
                    ...signup,
                    email: "second@example.com",
                    username: "secondone",
                    inviteCode: "GOLDENTICKET",
                }),
        ]);

        expect(responses.filter((response) => response.status === 200)).toHaveLength(1);
        expect(await db.users.countDocuments({})).toBe(1);
    });

    // A code is spent by a signup that succeeds, not by one that bounces off a
    // taken username — otherwise a typo burns someone's only invite.
    it("keeps the code unspent when the signup fails for another reason", async () => {
        await seedInvite("GOLDENTICKET");
        await db.users.insertOne({
            email: "squatter@example.com",
            username: signup.username,
            password: "x",
        });

        const response = await request(app)
            .post("/users")
            .send({ ...signup, inviteCode: "GOLDENTICKET" });
        expect(response.status).not.toBe(200);

        const invite = await db.invites.findOne({ code: "GOLDENTICKET" });
        expect(invite.usedAt).toBe(null);
        expect(invite.usedBy).toBe(null);
    });

    it("makes a code unique, so two invites cannot collide", async () => {
        await seedInvite("GOLDENTICKET");

        await expect(seedInvite("GOLDENTICKET")).rejects.toThrow();
    });
});

// The flag defaults off: nothing about registration changes until someone turns
// it on. Every other test in this suite signs up without a code.
describe("registration when the flag is off", () => {
    it("accepts a signup with no invite code", async () => {
        const response = await request(app).post("/users").send({
            email: "open@example.com",
            username: "openreg",
            password: "password123",
            passwordRepeat: "password123",
        });

        expect(response.status).toBe(200);
    });

    it("ignores an invite code that is offered anyway", async () => {
        const response = await request(app).post("/users").send({
            email: "open2@example.com",
            username: "openreg2",
            password: "password123",
            passwordRepeat: "password123",
            inviteCode: "does-not-exist",
        });

        expect(response.status).toBe(200);
    });
});
