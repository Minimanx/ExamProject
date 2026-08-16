import { describe, it, expect } from "vitest";
import { sortedBy } from "./theaterSort.js";

function theater(overrides) {
    return {
        eventName: "An evening",
        movieRuntime: 100,
        startTime: "2026-08-16T20:00:00.000Z",
        amountOfSpaces: 10,
        usersInsideTheater: [],
        ...overrides,
    };
}

const names = (sorted) => sorted.map((entry) => entry.eventName);

describe("ordering the listing", () => {
    it("sorts by name, and reverses", () => {
        const listing = [
            theater({ eventName: "Noir Evening" }),
            theater({ eventName: "Aliens Marathon" }),
            theater({ eventName: "Movie Night" }),
        ];

        expect(names(sortedBy(listing, "name"))).toEqual([
            "Aliens Marathon",
            "Movie Night",
            "Noir Evening",
        ]);
        expect(names(sortedBy(listing, "name", "desc"))).toEqual([
            "Noir Evening",
            "Movie Night",
            "Aliens Marathon",
        ]);
    });

    it("sorts by runtime, shortest first", () => {
        const listing = [
            theater({ eventName: "Long", movieRuntime: 201 }),
            theater({ eventName: "Short", movieRuntime: 88 }),
        ];

        expect(names(sortedBy(listing, "runtime"))).toEqual(["Short", "Long"]);
    });

    it("sorts by when it starts, soonest first", () => {
        const listing = [
            theater({ eventName: "Later", startTime: "2026-08-16T22:00:00.000Z" }),
            theater({ eventName: "Sooner", startTime: "2026-08-16T19:00:00.000Z" }),
        ];

        expect(names(sortedBy(listing, "startTime"))).toEqual(["Sooner", "Later"]);
    });

    // What the column actually shows. Sorting by the size of the room put a
    // sold-out twenty-seater above an empty ten-seater, under a heading that
    // reads "2/10" and a people icon.
    it("sorts by seats still free, not by the size of the room", () => {
        const listing = [
            theater({
                eventName: "Big but full",
                amountOfSpaces: 20,
                usersInsideTheater: Array(20),
            }),
            theater({ eventName: "Small and empty", amountOfSpaces: 10, usersInsideTheater: [] }),
        ];

        expect(names(sortedBy(listing, "spaces", "desc"))).toEqual([
            "Small and empty",
            "Big but full",
        ]);
    });

    // The listing is a prop. Sorting it in place reordered the caller's array
    // as a side effect of a click on a column header.
    it("leaves the listing it was given alone", () => {
        const listing = [theater({ eventName: "Zed" }), theater({ eventName: "Alpha" })];

        const sorted = sortedBy(listing, "name");

        expect(names(listing)).toEqual(["Zed", "Alpha"]);
        expect(sorted).not.toBe(listing);
    });

    it("returns the listing untouched when nothing is sorting it", () => {
        const listing = [theater({ eventName: "Zed" }), theater({ eventName: "Alpha" })];

        expect(sortedBy(listing, null)).toBe(listing);
    });

    // A listing arrives over the network and a row may be missing anything.
    it("does not throw on an incomplete row", () => {
        const listing = [theater({ eventName: undefined, movieRuntime: undefined }), theater({})];

        expect(() => sortedBy(listing, "name")).not.toThrow();
        expect(() => sortedBy(listing, "runtime")).not.toThrow();
        expect(() => sortedBy(listing, "spaces")).not.toThrow();
        expect(() => sortedBy(listing, "startTime")).not.toThrow();
    });

    it("is untroubled by an empty listing", () => {
        expect(sortedBy([], "name")).toEqual([]);
    });
});
