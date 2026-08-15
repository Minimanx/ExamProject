import { describe, it, expect } from "vitest";
import { formatDuration, formatTimeOfDay } from "./duration.js";
import { describeMeeting } from "./clubSchedule.js";

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

// The roadmap's Phase 2 asks for times stored in UTC and rendered in the
// viewer's locale. Storage was already right — Mongo holds Date objects, which
// are UTC — but rendering was `getHours()` and `getMinutes()` spelled out inline
// with hand-written zero padding, in two components, always 24-hour. A viewer
// who expects 8:30 PM saw 20:30.
describe("formatTimeOfDay", () => {
    const evening = new Date("2026-08-10T20:30:00Z");

    it("renders a 24-hour locale as 24-hour", () => {
        expect(formatTimeOfDay(evening, "en-GB", "UTC")).toBe("20:30");
    });

    it("renders a 12-hour locale as 12-hour", () => {
        expect(formatTimeOfDay(evening, "en-US", "UTC")).toMatch(/8:30\s?PM/i);
    });

    // The same instant is a different wall-clock time depending on where you
    // are, which is the entire point of storing UTC.
    it("shows the viewer's own wall clock, not the server's", () => {
        expect(formatTimeOfDay(evening, "en-GB", "Asia/Kolkata")).toBe("02:00");
    });

    it("pads a single-digit hour and minute", () => {
        expect(formatTimeOfDay(new Date("2026-08-10T09:05:00Z"), "en-GB", "UTC")).toBe("09:05");
    });

    it("accepts the string form the API sends", () => {
        expect(formatTimeOfDay("2026-08-10T20:30:00Z", "en-GB", "UTC")).toBe("20:30");
    });

    // Chat timestamps carry seconds; a theater's start time does not.
    it("includes seconds when asked", () => {
        expect(
            formatTimeOfDay(new Date("2026-08-10T20:30:07Z"), "en-GB", "UTC", { seconds: true })
        ).toBe("20:30:07");
    });

    it("renders nothing rather than 'Invalid Date' for a missing time", () => {
        expect(formatTimeOfDay(undefined)).toBe("");
    });
});

// A club's schedule is stated in its own timezone, which is what makes it mean
// the same thing after the clocks change. Naming that zone is essential when it
// is not the reader's and noise when it is — "Tuesdays at 19:30
// (Europe/Copenhagen)" tells a Copenhagen reader nothing they did not know, and
// costs a line of wrapping to say it.
describe("describeMeeting", () => {
    const schedule = { weekday: 2, hour: 19, minute: 30, timeZone: "Europe/Copenhagen" };

    it("leaves out the zone when it is the reader's own", () => {
        expect(describeMeeting(schedule, "Europe/Copenhagen")).toBe("Tuesdays at 19:30");
    });

    it("names the zone when it is somewhere else", () => {
        expect(describeMeeting(schedule, "America/New_York")).toBe(
            "Tuesdays at 19:30 (Europe/Copenhagen)"
        );
    });

    it("pads a single-digit hour and minute", () => {
        expect(describeMeeting({ ...schedule, hour: 9, minute: 5 }, "Europe/Copenhagen")).toBe(
            "Tuesdays at 09:05"
        );
    });

    it("says so when there is no regular meeting", () => {
        expect(describeMeeting(null, "Europe/Copenhagen")).toBe("No regular meeting");
    });

    // A zone it cannot resolve is not a reason to render nothing.
    it("falls back to naming the zone when the reader's is unknown", () => {
        expect(describeMeeting(schedule, undefined)).toBe("Tuesdays at 19:30 (Europe/Copenhagen)");
    });
});
