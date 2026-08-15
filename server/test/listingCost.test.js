import { describe, it, expect, afterEach, vi } from "vitest";
import { io } from "../app.js";
import db from "../database/createConnection.js";
import { listTheaters } from "../services/theaterService.js";
import { registerSocketServer } from "../socketios/presence.js";
import { seedTheater } from "./helpers.js";

/**
 * The listing is the hottest endpoint in the app: every page load, and again on
 * every debounced keystroke in the search box. It reconciles each theater's
 * occupant list against who really has a socket open, and it used to ask that
 * question one theater at a time — an awaited adapter round-trip and a possible
 * write per theater, in sequence. Twenty-five theaters measured twenty-five
 * round-trips, so the page got slower exactly as the product got busier.
 *
 * These tests assert the cost, not just the answer. Correctness is already
 * covered by the ghost-occupant tests in theatersJoinDelete; a sweep that is
 * right and linear would pass those and still be the bug.
 */
function countingIo(occupied = new Map()) {
    const counts = { roomQueries: 0 };
    return {
        counts,
        server: {
            sockets: { sockets: new Map() },
            in(room) {
                counts.roomQueries++;
                return { fetchSockets: async () => occupied.get(room) ?? [] };
            },
        },
    };
}

const log = { error: () => {} };

/** Someone who joined long enough ago to be past the grace period. */
function ghost(userID) {
    return { userID, joinedAt: new Date(Date.now() - 5 * 60 * 1000) };
}

afterEach(() => {
    // app.js registers the real server at import; put it back for other files.
    registerSocketServer(io);
    vi.restoreAllMocks();
});

describe("the cost of listing theaters", () => {
    it("asks who is connected once, not once per theater", async () => {
        for (let index = 0; index < 25; index++) {
            await seedTheater({ eventName: `Event ${index}` });
        }
        const counting = countingIo();
        registerSocketServer(counting.server);

        await listTheaters(log);

        expect(counting.counts.roomQueries).toBe(0);
    });

    it("sweeps every theater's ghosts in one write", async () => {
        for (let index = 0; index < 10; index++) {
            await seedTheater({
                eventName: `Haunted ${index}`,
                usersInsideTheater: [ghost(`ghost-${index}`)],
            });
        }
        registerSocketServer(countingIo().server);
        const bulkWrite = vi.spyOn(db.theaters, "bulkWrite");
        const updateOne = vi.spyOn(db.theaters, "updateOne");

        const listed = await listTheaters(log);

        expect(bulkWrite).toHaveBeenCalledTimes(1);
        expect(updateOne).not.toHaveBeenCalled();
        // The write is only worth batching if it is the same write: every
        // haunted theater comes back empty, and stays empty on disk.
        const haunted = listed.filter((theater) => theater.eventName.startsWith("Haunted"));
        expect(haunted).toHaveLength(10);
        expect(haunted.every((theater) => theater.usersInsideTheater.length === 0)).toBe(true);
        const stored = await db.theaters.find({ eventName: /^Haunted/ }).toArray();
        expect(stored.every((theater) => theater.usersInsideTheater.length === 0)).toBe(true);
    });

    it("writes nothing when every theater is already accurate", async () => {
        await seedTheater({ eventName: "Quiet" });
        registerSocketServer(countingIo().server);
        const bulkWrite = vi.spyOn(db.theaters, "bulkWrite");

        await listTheaters(log);

        expect(bulkWrite).not.toHaveBeenCalled();
    });

    // "Nobody is connected" and "there is nothing to ask" are different
    // answers, and confusing them would empty every theater in the app.
    it("sweeps nobody when there is no socket server to ask", async () => {
        const theater = await seedTheater({
            eventName: "Unreconciled",
            usersInsideTheater: [ghost("ghost-1")],
        });
        registerSocketServer(null);

        const listed = await listTheaters(log);

        const found = listed.find((entry) => entry._id.equals(theater._id));
        expect(found.usersInsideTheater).toHaveLength(1);
        const stored = await db.theaters.findOne({ _id: theater._id });
        expect(stored.usersInsideTheater).toHaveLength(1);
    });

    // hasSpace filters on the reconciled count, and an old document has no
    // occupant list at all — the normalisation to [] has to survive both paths.
    it("counts a theater with no occupant list as empty", async () => {
        await db.theaters.insertOne({ eventName: "Ancient", amountOfSpaces: 4, position: 900 });
        registerSocketServer(null);

        const listed = await listTheaters(log, { hasSpace: "true" });

        expect(listed.some((theater) => theater.eventName === "Ancient")).toBe(true);
    });
});
