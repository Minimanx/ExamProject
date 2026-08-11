import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../app.js";
import db, {
    indexesReady,
    backfillModerationState,
    dropSupersededIndex,
    mongoClientPromise,
} from "../database/createConnection.js";

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

// Index setup used to be one Promise.all whose rejection was caught and logged.
// A single failing entry therefore cancelled every other index and left the
// process running as though nothing were wrong — which is how a `dropIndex` on a
// not-yet-created collection (NamespaceNotFound, not IndexNotFound) removed every
// uniqueness guarantee in the database at once, including the one holding
// "at most N events per owner" together.
//
// Asserting the built set is the only way to notice: nothing else fails.
describe("every declared index is actually built", () => {
    const expected = {
        users: [{ email: 1 }, { username: 1 }],
        theaters: [{ position: 1 }, { timeToClose: 1 }, { ownerID: 1, ownerSlot: 1 }],
        reports: [
            { subjectID: 1, createdAt: -1 },
            { state: 1, createdAt: 1 },
        ],
        blocks: [{ blockerID: 1, blockedID: 1 }, { blockedID: 1 }],
        invites: [{ code: 1 }],
    };

    it.each(Object.entries(expected))("%s", async (collection, keys) => {
        await indexesReady;
        const built = (await db[collection].indexes()).map((index) => JSON.stringify(index.key));

        for (const key of keys) {
            expect(built).toContain(JSON.stringify(key));
        }
    });

    // The superseded one enforced "at most one event per owner" regardless of
    // what the compound index says, so leaving it behind pins the limit at 1.
    //
    // Recreating it first is the point: on a fresh database it never existed,
    // so asserting its absence proves nothing about the databases that matter —
    // the ones that ran the previous version.
    it("drops the superseded ownerID index when one is there to drop", async () => {
        await indexesReady;
        await db.theaters.createIndex({ ownerID: 1 }, { unique: true });
        expect((await db.theaters.indexes()).map((i) => i.name)).toContain("ownerID_1");

        await dropSupersededIndex(db.theaters, "ownerID_1");

        expect((await db.theaters.indexes()).map((i) => i.name)).not.toContain("ownerID_1");
    });

    // A fresh database has no collections at all, so the drop answers
    // NamespaceNotFound rather than IndexNotFound. That case never appears in a
    // full test run, because some earlier file has always created the
    // collection — only a first deploy sees it.
    it("is untroubled by a collection that does not exist yet", async () => {
        const client = await mongoClientPromise;
        const neverUsed = client
            .db("FlixDrive")
            .collection(`never-created-${Date.now().toString(36)}`);

        await expect(dropSupersededIndex(neverUsed, "anything_1")).resolves.toBeUndefined();
    });

    it("is untroubled by a superseded index that is already gone", async () => {
        await indexesReady;

        await expect(dropSupersededIndex(db.theaters, "ownerID_1")).resolves.toBeUndefined();
    });
});
