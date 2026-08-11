import { describe, it, expect } from "vitest";
import db from "../database/createConnection.js";
import * as theaters from "../services/theaterService.js";

// Phase 3 makes "how many live events may one person have" configurable. Phase 2
// enforced it with a unique index on ownerID, which is what stopped two
// overlapping requests both creating an event (defect C4) — but a unique index
// says "at most one", not "at most N".
//
// Each theater carries an ownerSlot in 0..limit-1, with the index moved to
// { ownerID, ownerSlot }. The database still decides, so the guarantee survives
// concurrency the way the ownerID index did.
//
// The limit is a parameter rather than read from the environment inside the
// service: these tests vary it, and a module-level value read at import time
// cannot be varied without a test-only backdoor in production code.
describe("owner slot allocation", () => {
    function theaterFor(ownerID, overrides = {}) {
        return {
            eventName: "Movie Night",
            startTime: new Date(Date.now() + 3600000),
            timeToClose: new Date(Date.now() + 10800000),
            amountOfSpaces: 10,
            imdbID: "tt0000001",
            movieName: "Test Movie",
            movieRuntime: 120,
            ownerID,
            ...overrides,
        };
    }

    it("gives a first event slot 0", async () => {
        await theaters.createTheater(theaterFor("owner-a"), { maxEventsPerOwner: 1 });

        const stored = await db.theaters.findOne({ ownerID: "owner-a" });
        expect(stored.ownerSlot).toBe(0);
    });

    it("refuses a second event when the limit is one", async () => {
        await theaters.createTheater(theaterFor("owner-a"), { maxEventsPerOwner: 1 });

        await expect(
            theaters.createTheater(theaterFor("owner-a"), { maxEventsPerOwner: 1 })
        ).rejects.toBeInstanceOf(theaters.OwnerConflictError);
    });

    it("allows a second event when the limit is two, in the next slot", async () => {
        await theaters.createTheater(theaterFor("owner-a"), { maxEventsPerOwner: 2 });
        await theaters.createTheater(theaterFor("owner-a"), { maxEventsPerOwner: 2 });

        const stored = await db.theaters.find({ ownerID: "owner-a" }).toArray();
        expect(stored.map((theater) => theater.ownerSlot).sort()).toEqual([0, 1]);
    });

    it("refuses the third when the limit is two", async () => {
        await theaters.createTheater(theaterFor("owner-a"), { maxEventsPerOwner: 2 });
        await theaters.createTheater(theaterFor("owner-a"), { maxEventsPerOwner: 2 });

        await expect(
            theaters.createTheater(theaterFor("owner-a"), { maxEventsPerOwner: 2 })
        ).rejects.toBeInstanceOf(theaters.OwnerConflictError);
    });

    // Deleting an event should hand the slot back, or a host who creates and
    // cancels repeatedly runs out despite holding nothing.
    it("reuses a slot freed by a deleted event", async () => {
        await theaters.createTheater(theaterFor("owner-a"), { maxEventsPerOwner: 1 });
        const first = await db.theaters.findOne({ ownerID: "owner-a" });
        await theaters.deleteTheater(first._id);

        await theaters.createTheater(theaterFor("owner-a"), { maxEventsPerOwner: 1 });

        const stored = await db.theaters.findOne({ ownerID: "owner-a" });
        expect(stored.ownerSlot).toBe(0);
    });

    it("does not let one owner's slots limit another's", async () => {
        await theaters.createTheater(theaterFor("owner-a"), { maxEventsPerOwner: 1 });

        await theaters.createTheater(theaterFor("owner-b"), { maxEventsPerOwner: 1 });

        expect(await db.theaters.countDocuments({})).toBe(2);
    });

    // The whole reason the rule lives in an index. A count-then-insert lets
    // every racing request read the same count and all of them proceed.
    it("lets exactly the limit through when requests arrive together", async () => {
        const attempts = Array.from({ length: 5 }, () =>
            theaters
                .createTheater(theaterFor("owner-a"), { maxEventsPerOwner: 2 })
                .then(() => "created")
                .catch((error) =>
                    error instanceof theaters.OwnerConflictError ? "refused" : Promise.reject(error)
                )
        );

        const outcomes = await Promise.all(attempts);

        expect(outcomes.filter((outcome) => outcome === "created")).toHaveLength(2);
        expect(await db.theaters.countDocuments({ ownerID: "owner-a" })).toBe(2);
    });
});
