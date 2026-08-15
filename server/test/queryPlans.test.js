import { describe, it, expect, beforeAll } from "vitest";
import db, { indexesReady } from "../database/createConnection.js";

// Defect O1 was "no indexes on any collection; every signup ran two full scans".
// It was fixed for users and theaters, and then quietly reintroduced for every
// collection added afterwards — an index that exists is not the same as an index
// the query can use.
//
// Asserting the plan rather than the index catches the difference. A compound
// index on { pairLow, pairHigh } serves a query on pairLow and does nothing at
// all for one on pairHigh, which is exactly half of how a friend list is read.
async function planFor(collection, filter, options = {}) {
    const explained = await collection.find(filter, options).explain("queryPlanner");
    return JSON.stringify(explained.queryPlanner.winningPlan);
}

/**
 * The collation usernames are unique under.
 *
 * A username query without it is genuinely unindexed, and correctly so — a
 * collated index cannot serve a case-sensitive query. The rule this asserts is
 * that the app never issues one, because a case-sensitive lookup would also
 * answer "no such user" about someone whose name differs only in capitals.
 */
const USERNAME_COLLATION = { collation: { locale: "en", strength: 1 } };

/** A plan that reads the whole collection, however it is nested. */
function scansEverything(plan) {
    return plan.includes("COLLSCAN");
}

beforeAll(async () => {
    await indexesReady;
});

describe("the queries this app actually runs are indexed", () => {
    it("finds a friendship from either side of the pair", async () => {
        const asLow = await planFor(db.friendships, { pairLow: "someone" });
        const asHigh = await planFor(db.friendships, { pairHigh: "someone" });

        expect(scansEverything(asLow)).toBe(false);
        expect(scansEverything(asHigh)).toBe(false);
    });

    // How a friend list is loaded: both directions at once.
    it("lists everyone connected to one person without a scan", async () => {
        const plan = await planFor(db.friendships, {
            $or: [{ pairLow: "someone" }, { pairHigh: "someone" }],
        });

        expect(scansEverything(plan)).toBe(false);
    });

    it("finds a user by email", async () => {
        expect(scansEverything(await planFor(db.users, { email: "a@b.co" }))).toBe(false);
    });

    it("finds a user by username the way the app looks one up", async () => {
        const plan = await planFor(db.users, { username: "someone" }, USERNAME_COLLATION);

        expect(scansEverything(plan)).toBe(false);
    });

    it("finds a club by its slug, which is how every public page loads", async () => {
        expect(scansEverything(await planFor(db.clubs, { slug: "thursday-noir" }))).toBe(false);
    });

    it("lists public clubs without reading the private ones", async () => {
        expect(scansEverything(await planFor(db.clubs, { isPublic: true }))).toBe(false);
    });

    it("finds a member's clubs and a club's members", async () => {
        expect(scansEverything(await planFor(db.clubMembers, { userID: "someone" }))).toBe(false);
        expect(scansEverything(await planFor(db.clubMembers, { clubID: "a-club" }))).toBe(false);
    });

    it("finds an invite by code", async () => {
        expect(scansEverything(await planFor(db.invites, { code: "GOLDEN" }))).toBe(false);
    });

    it("sweeps expired theaters without reading the live ones", async () => {
        const plan = await planFor(db.theaters, { timeToClose: { $lt: new Date() } });

        expect(scansEverything(plan)).toBe(false);
    });

    it("counts a user's live events without a scan", async () => {
        expect(scansEverything(await planFor(db.theaters, { ownerID: "someone" }))).toBe(false);
    });
});
