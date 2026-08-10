import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../app.js";
import db, { indexesReady, backfillModerationState } from "../database/createConnection.js";

// Roadmap §3, hedge 2: the safety data models land now, unused. The sequencing
// chosen was "features first, safety retrofitted", and the risk that carries is
// that retrofitting moderation into a live social product is how products get
// overrun. Retrofitting UI is easy; retrofitting a data model across a database
// with real user history is not. Nothing reads any of this until Phase 9 — these
// tests exist so the shape cannot drift or be quietly dropped in the meantime.
describe("safety data models", () => {
    it("exposes the reports and blocks collections", () => {
        expect(db.reports).toBeDefined();
        expect(db.blocks).toBeDefined();
    });

    it("indexes reports by who they are about, newest first", async () => {
        await indexesReady;
        const indexes = await db.reports.indexes();

        expect(indexes.map((index) => index.key)).toContainEqual({ subjectID: 1, createdAt: -1 });
    });

    it("indexes reports by state so a queue can be drained oldest first", async () => {
        await indexesReady;
        const indexes = await db.reports.indexes();

        expect(indexes.map((index) => index.key)).toContainEqual({ state: 1, createdAt: 1 });
    });

    // One person blocking another twice is the same block. Enforcing that in the
    // database means the eventual UI cannot create duplicates by double-submit.
    it("makes a block unique per pair", async () => {
        await indexesReady;
        const pair = await db.blocks
            .indexes()
            .then((indexes) =>
                indexes.find(
                    (index) =>
                        JSON.stringify(index.key) === JSON.stringify({ blockerID: 1, blockedID: 1 })
                )
            );

        expect(pair).toBeDefined();
        expect(pair.unique).toBe(true);
    });

    it("rejects a duplicate block", async () => {
        await indexesReady;
        const block = { blockerID: "a", blockedID: "b", createdAt: new Date() };
        await db.blocks.insertOne({ ...block });

        await expect(db.blocks.insertOne({ ...block })).rejects.toThrow();

        await db.blocks.deleteMany({ blockerID: "a" });
    });

    // The reverse lookup — "who has blocked me" — is what filtering a room needs.
    it("indexes blocks for the reverse lookup", async () => {
        await indexesReady;
        const indexes = await db.blocks.indexes();

        expect(indexes.map((index) => index.key)).toContainEqual({ blockedID: 1 });
    });
});

describe("moderationState on users", () => {
    it("gives a new account an explicit state rather than leaving it absent", async () => {
        const email = `moderation-${Date.now()}@example.com`;
        const response = await request(app)
            .post("/users")
            .send({
                email,
                username: `mod${Date.now().toString(36).slice(-6)}`,
                password: "password123",
                passwordRepeat: "password123",
            });
        expect(response.status).toBe(200);

        const stored = await db.users.findOne({ email });
        expect(stored.moderationState).toBe("active");
    });

    // Accounts created before this field existed have no value for it. Phase 9
    // should never have to special-case that, so boot backfills them once.
    it("backfills accounts that predate the field", async () => {
        await db.users.insertOne({
            email: "legacy@example.com",
            username: "legacyuser",
            password: "x",
        });

        await backfillModerationState();

        const stored = await db.users.findOne({ email: "legacy@example.com" });
        expect(stored.moderationState).toBe("active");
    });

    it("leaves an account that is already in a non-default state alone", async () => {
        await db.users.insertOne({
            email: "banned@example.com",
            username: "banneduser",
            password: "x",
            moderationState: "banned",
        });

        await backfillModerationState();

        const stored = await db.users.findOne({ email: "banned@example.com" });
        expect(stored.moderationState).toBe("banned");
    });
});
