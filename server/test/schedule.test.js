import { describe, it, expect } from "vitest";
import { nextOccurrence, describeSchedule } from "../world/schedule.js";

// A club that meets "Thursdays at 20:00 in Copenhagen" means 20:00 as read on a
// Copenhagen clock. Stored as a UTC instant, that silently becomes 19:00 or
// 21:00 the moment the clocks change, and every member is an hour wrong twice a
// year.
//
// This is the same class of mistake as defect C2, and it survived there for the
// same reason it would survive here: the machine this is developed on sits at
// UTC+1, where a wrong implementation looks right for half the year. Every test
// names its zone rather than inheriting one.
describe("nextOccurrence", () => {
    // Thursday 20:00 in Copenhagen. 0 is Sunday, matching Date#getDay.
    const thursdayEvening = { weekday: 4, hour: 20, minute: 0, timeZone: "Europe/Copenhagen" };

    it("finds the coming Thursday from a Monday", () => {
        // Monday 2026-08-10, midday UTC.
        const from = new Date("2026-08-10T12:00:00Z");

        const next = nextOccurrence(thursdayEvening, from);

        // Copenhagen is UTC+2 in August, so 20:00 local is 18:00 UTC.
        expect(next.toISOString()).toBe("2026-08-13T18:00:00.000Z");
    });

    it("finds today's meeting if it has not started yet", () => {
        // Thursday 2026-08-13, 10:00 UTC — before the 18:00 UTC meeting.
        const from = new Date("2026-08-13T10:00:00Z");

        expect(nextOccurrence(thursdayEvening, from).toISOString()).toBe(
            "2026-08-13T18:00:00.000Z"
        );
    });

    it("skips to next week once today's has started", () => {
        // Thursday 2026-08-13, 19:00 UTC — after it began.
        const from = new Date("2026-08-13T19:00:00Z");

        expect(nextOccurrence(thursdayEvening, from).toISOString()).toBe(
            "2026-08-20T18:00:00.000Z"
        );
    });

    // The reason the schedule is a wall clock and not an instant. Copenhagen is
    // UTC+2 in summer and UTC+1 in winter, and the club meets at 20:00 in both.
    it("still means 20:00 local after the clocks go back", () => {
        // Copenhagen leaves summer time on 2026-10-25.
        const beforeChange = new Date("2026-10-20T12:00:00Z");
        const afterChange = new Date("2026-10-27T12:00:00Z");

        // 20:00 CEST is 18:00 UTC; 20:00 CET is 19:00 UTC. Both are 20:00 local.
        expect(nextOccurrence(thursdayEvening, beforeChange).toISOString()).toBe(
            "2026-10-22T18:00:00.000Z"
        );
        expect(nextOccurrence(thursdayEvening, afterChange).toISOString()).toBe(
            "2026-10-29T19:00:00.000Z"
        );
    });

    it("works for a zone that does not observe daylight saving", () => {
        const tokyo = { weekday: 4, hour: 20, minute: 0, timeZone: "Asia/Tokyo" };
        const from = new Date("2026-08-10T12:00:00Z");

        // Tokyo is UTC+9 all year, so 20:00 local is 11:00 UTC.
        expect(nextOccurrence(tokyo, from).toISOString()).toBe("2026-08-13T11:00:00.000Z");
    });

    it("works for a zone on a half-hour offset", () => {
        const kolkata = { weekday: 4, hour: 20, minute: 0, timeZone: "Asia/Kolkata" };
        const from = new Date("2026-08-10T12:00:00Z");

        // UTC+5:30, so 20:00 local is 14:30 UTC.
        expect(nextOccurrence(kolkata, from).toISOString()).toBe("2026-08-13T14:30:00.000Z");
    });

    it("handles a meeting on Sunday, which is weekday zero", () => {
        const sunday = { weekday: 0, hour: 11, minute: 30, timeZone: "Europe/Copenhagen" };
        const from = new Date("2026-08-10T12:00:00Z");

        expect(nextOccurrence(sunday, from).toISOString()).toBe("2026-08-16T09:30:00.000Z");
    });

    // A test that inherits the machine's zone passes here and fails on a
    // colleague's laptop. Naming the zone is what makes the answer a fact.
    it("gives the same answer whatever the server's own zone is", () => {
        const original = process.env.TZ;
        const answers = new Set();

        for (const zone of ["UTC", "Europe/Copenhagen", "America/New_York", "Asia/Kolkata"]) {
            process.env.TZ = zone;
            answers.add(
                nextOccurrence(thursdayEvening, new Date("2026-08-10T12:00:00Z")).toISOString()
            );
        }
        process.env.TZ = original;

        expect([...answers]).toEqual(["2026-08-13T18:00:00.000Z"]);
    });
});

describe("describeSchedule", () => {
    it("reads as a sentence", () => {
        expect(
            describeSchedule({ weekday: 4, hour: 20, minute: 0, timeZone: "Europe/Copenhagen" })
        ).toBe("Thursdays at 20:00 (Europe/Copenhagen)");
    });

    it("pads a single-digit minute", () => {
        expect(
            describeSchedule({ weekday: 0, hour: 9, minute: 5, timeZone: "Europe/Copenhagen" })
        ).toBe("Sundays at 09:05 (Europe/Copenhagen)");
    });

    it("says so when there is no schedule", () => {
        expect(describeSchedule(null)).toBe("No regular meeting");
    });
});
