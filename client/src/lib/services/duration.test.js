import { describe, it, expect } from "vitest";
import { formatDuration } from "./duration.js";

// DEFECT C2 (roadmap spec §5): the three countdowns in InsideTheater.svelte
// each turned a duration into hh:mm:ss by constructing `new Date(duration)` —
// a moment 'duration' milliseconds after the epoch — and reading getHours(),
// getMinutes() and getSeconds() off it. Those are local-time accessors, so the
// viewer's UTC offset was added to the answer, and a hardcoded `- 3600000`
// subtracted one hour to cancel it. That cancels exactly once: in CET winter.
describe("formatDuration", () => {
    it.each([
        [0, "00:00:00"],
        [1000, "00:00:01"],
        [59000, "00:00:59"],
        [60000, "00:01:00"],
        [3599000, "00:59:59"],
        [3600000, "01:00:00"],
        [7265000, "02:01:05"],
    ])("renders %i ms as %s", (milliseconds, expected) => {
        expect(formatDuration(milliseconds)).toBe(expected);
    });

    // A movie longer than a day is not the point; wrapping at 24 hours is. The
    // old code inherited getHours()' 0-23 range, so a 25 hour duration read as
    // one hour.
    it("counts past 24 hours instead of wrapping", () => {
        expect(formatDuration(25 * 3600000)).toBe("25:00:00");
    });

    // Every caller subtracts two timestamps, and the losing side of that
    // subtraction is negative for a whole render frame around the boundary.
    it("floors a negative duration at zero rather than rendering a negative clock", () => {
        expect(formatDuration(-5000)).toBe("00:00:00");
    });

    it("is independent of the viewer's time zone", () => {
        const original = process.env.TZ;
        const seen = new Set();

        for (const zone of ["UTC", "Europe/Copenhagen", "America/New_York", "Asia/Kolkata"]) {
            process.env.TZ = zone;
            seen.add(formatDuration(7265000));
        }
        process.env.TZ = original;

        expect([...seen]).toEqual(["02:01:05"]);
    });
});
