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

        expect(result.accepted).toBe(true);
        expect(result.position).toMatchObject({ x: 120, y: 600 });
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

    // Someone who has just arrived has not been moving, so by definition they
    // have earned the full carry-over. Starting them with an empty bank is what
    // made the first report after joining the one most likely to be refused —
    // and a refusal there snaps the car back to the spawn point, which is the
    // first thing a new player would see.
    it("lets a player who just joined move immediately", () => {
        const joined = acceptMove(null, { x: 60, y: 600 }, 1_000_000);

        // A report 60ms later carrying a burst of frames' worth of movement:
        // more than 60ms of travel, well within a second's banked budget.
        const firstStep = acceptMove(joined.position, { x: 88, y: 572 }, 1_000_060);

        expect(firstStep.accepted).toBe(true);
    });

    it("still refuses a joined player teleporting across the world", () => {
        const joined = acceptMove(null, { x: 60, y: 600 }, 1_000_000);

        const jump = acceptMove(joined.position, { x: 4000, y: 600 }, 1_000_060);

        expect(jump.accepted).toBe(false);
    });

    it("gives a first move the benefit of the doubt", () => {
        const result = acceptMove(null, { x: 900, y: 600 }, 1_000_000);

        expect(result.accepted).toBe(true);
        expect(result.position).toMatchObject({ x: 900, y: 600 });
    });

    it("accepts the very edge of the road", () => {
        const atEdge = { x: 100, y: WORLD.minY };

        expect(acceptMove(from, atEdge, from.at + 1000).accepted).toBe(true);
    });

    it("still bounds a first move to the world", () => {
        const result = acceptMove(null, { x: 900, y: 5 }, 1_000_000);

        expect(result.accepted).toBe(false);
    });
});

// The limit is a budget over time, and a client's frames never line up with the
// server's clock. The first report after joining is the worst case: the server
// stamped its arrival, the client had already been integrating frames, and the
// difference is charged against a budget that has barely started accruing.
//
// A player on a slow connection sends less often and further, which is the same
// shape. Refusing those is the rubber-banding this limit exists to prevent, but
// aimed at honest players.
describe("acceptMove absorbs timing jitter", () => {
    const from = { x: 100, y: 600, at: 1_000_000 };

    it("accepts a step whose travel is covered by time already banked", () => {
        // 300ms of accrued budget spent in one late report: 75px.
        const result = acceptMove(from, { x: 170, y: 600 }, from.at + 300);

        expect(result.accepted).toBe(true);
    });

    // The budget is time, so spending it leaves less. Carrying a remainder
    // forward must not add up to a faster car — what it buys is tolerance of
    // when the reports arrive, not extra ground.
    it("holds sustained speed to the limit however the reports are spaced", () => {
        let at = { ...from };

        // Five seconds of asking for three times the speed, in 100ms reports.
        for (let i = 1; i <= 50; i++) {
            const result = acceptMove(at, { x: at.x + 75, y: 600 }, from.at + i * 100);
            at = result.position;
        }

        const travelled = at.x - from.x;
        const seconds = 5;
        const achieved = travelled / seconds;

        // The limit plus its jitter allowance, and nothing like the 750 px/s asked for.
        expect(achieved).toBeLessThanOrEqual(250 * 1.35 + 1);
    });

    // Otherwise standing still for a minute buys a teleport across the world.
    it("does not bank unlimited credit while standing still", () => {
        const parked = { x: 100, y: 600, at: 1_000_000 };

        const result = acceptMove(parked, { x: 5000, y: 600 }, parked.at + 60_000);

        expect(result.accepted).toBe(false);
    });

    it("banks at most a short burst", () => {
        const parked = { x: 100, y: 600, at: 1_000_000 };
        // A second of accrued budget is 250px; well over that must still fail.
        const result = acceptMove(parked, { x: 1200, y: 600 }, parked.at + 60_000);

        expect(result.accepted).toBe(false);
    });
});
