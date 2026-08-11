import { describe, it, expect } from "vitest";
import { WORLD, acceptMove } from "../world/movement.js";

// Phase 4: the client was authoritative over its own position and trivially
// spoofable. The server now holds the position and accepts a proposal only if it
// could have been reached.
//
// This stopped being cosmetic in Phase 3: proximity chat decides who hears a
// message from the server's position, so a spoofed position is an eavesdropping
// tool rather than only an unfair advantage.
describe("acceptMove", () => {
    const from = { x: 100, y: 600, at: 1_000_000 };

    it("accepts a step the player could have driven", () => {
        // 250 px/s for 100ms is 25px.
        const result = acceptMove(from, { x: 120, y: 600 }, from.at + 100);

        expect(result).toEqual({ accepted: true, position: { x: 120, y: 600, at: from.at + 100 } });
    });

    it("refuses a jump across the world", () => {
        const result = acceptMove(from, { x: 5000, y: 600 }, from.at + 100);

        expect(result.accepted).toBe(false);
    });

    // The correction is what stops a rejected client drifting away silently:
    // it has to be told where it actually is.
    it("reports the position it kept when it refuses", () => {
        const result = acceptMove(from, { x: 5000, y: 600 }, from.at + 100);

        expect(result.position).toEqual(from);
    });

    it("allows a longer step when more time has passed", () => {
        const result = acceptMove(from, { x: 340, y: 600 }, from.at + 1000);

        expect(result.accepted).toBe(true);
    });

    // Frames are uneven and packets arrive late. A limit with no slack rejects
    // honest players, which is worse than letting a cheat move 5% too fast.
    it("tolerates a little more than the exact limit", () => {
        const exact = 250 * 0.1;
        const result = acceptMove(from, { x: from.x + exact * 1.1, y: 600 }, from.at + 100);

        expect(result.accepted).toBe(true);
    });

    it("still refuses well past the tolerance", () => {
        const exact = 250 * 0.1;
        const result = acceptMove(from, { x: from.x + exact * 3, y: 600 }, from.at + 100);

        expect(result.accepted).toBe(false);
    });

    it("measures distance diagonally, not per axis", () => {
        // 25px on each axis is 35.4px of travel, past the 25px budget.
        const result = acceptMove(from, { x: 125, y: 625 }, from.at + 100);

        expect(result.accepted).toBe(false);
    });

    it.each([
        ["above the road", { x: 100, y: WORLD.minY - 1 }],
        ["below the road", { x: 100, y: WORLD.maxY + 1 }],
        ["left of the world", { x: -1, y: 600 }],
    ])("refuses a position %s", (_, proposed) => {
        const result = acceptMove(from, proposed, from.at + 1000);

        expect(result.accepted).toBe(false);
    });

    it("accepts the very edge of the road", () => {
        const atEdge = { x: 100, y: WORLD.minY };

        expect(acceptMove(from, atEdge, from.at + 1000).accepted).toBe(true);
    });

    it.each([
        ["a string", { x: "100", y: 600 }],
        ["a missing axis", { x: 100 }],
        ["nothing at all", undefined],
        ["infinity", { x: Infinity, y: 600 }],
        ["not a number", { x: NaN, y: 600 }],
    ])("refuses %s as a position", (_, proposed) => {
        const result = acceptMove(from, proposed, from.at + 100);

        expect(result.accepted).toBe(false);
        expect(result.position).toEqual(from);
    });

    // Time is taken from the server's clock, not the client's, so a client that
    // claims hours have passed gains nothing. This asserts the guard against a
    // stamp older than the last accepted one, which would otherwise make the
    // elapsed budget negative.
    it("refuses a move stamped before the last one", () => {
        const result = acceptMove(from, { x: 110, y: 600 }, from.at - 5000);

        expect(result.accepted).toBe(false);
    });

    it("gives a first move the benefit of the doubt", () => {
        const result = acceptMove(null, { x: 900, y: 600 }, 1_000_000);

        expect(result.accepted).toBe(true);
        expect(result.position).toMatchObject({ x: 900, y: 600 });
    });

    it("still bounds a first move to the world", () => {
        const result = acceptMove(null, { x: 900, y: 5 }, 1_000_000);

        expect(result.accepted).toBe(false);
    });
});
