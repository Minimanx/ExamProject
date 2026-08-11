import { describe, it, expect } from "vitest";
import { readLimits } from "../limits.js";

// Phase 3 lifts three hardcoded numbers: the 24-hour scheduling window, the
// 99-seat cap, and one-event-per-owner. Phase 8 turns them into the free/paid
// boundary, so they need one home now rather than being spread across a route
// body, a schema message and a database index.
describe("readLimits", () => {
    it("reproduces today's behaviour when nothing is set", () => {
        expect(readLimits({})).toEqual({
            schedulingWindowHours: 24,
            maxSeats: 99,
            maxEventsPerOwner: 1,
        });
    });

    it.each([
        ["MAX_SCHEDULING_WINDOW_HOURS", "72", "schedulingWindowHours", 72],
        ["MAX_SEATS", "250", "maxSeats", 250],
        ["MAX_EVENTS_PER_OWNER", "3", "maxEventsPerOwner", 3],
    ])("reads %s", (variable, value, key, expected) => {
        expect(readLimits({ [variable]: value })[key]).toBe(expected);
    });

    // A limit that silently falls back to its default when misconfigured is
    // worse than one that refuses to start: the deployment looks fine and
    // behaves as though the setting was never written.
    it.each(["nonsense", "0", "-5", "2.5", ""])("refuses %s as a seat limit", (value) => {
        expect(() => readLimits({ MAX_SEATS: value })).toThrow(/MAX_SEATS/);
    });

    it("names the variable and the value it could not use", () => {
        expect(() => readLimits({ MAX_EVENTS_PER_OWNER: "lots" })).toThrow(
            /MAX_EVENTS_PER_OWNER.*lots/
        );
    });
});
