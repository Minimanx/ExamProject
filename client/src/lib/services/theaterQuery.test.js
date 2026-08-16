import { describe, it, expect } from "vitest";
import { listingQuery, narrows } from "./theaterQuery.js";

describe("asking the listing for a narrowed strip", () => {
    it("asks for nothing in particular when nothing is set", () => {
        expect(listingQuery()).toBe("");
    });

    it("sends a search term", () => {
        expect(listingQuery({ term: "noir" })).toBe("q=noir");
    });

    it("trims the term, so a stray space is not a different search", () => {
        expect(listingQuery({ term: "  noir  " })).toBe("q=noir");
    });

    // The term is whatever somebody typed. Concatenated, an ampersand in an
    // event name arrives as a second parameter and the server searches for the
    // half in front of it.
    it("encodes a term that would otherwise change the query", () => {
        expect(listingQuery({ term: "Bell & Sebastian" })).toBe("q=Bell+%26+Sebastian");
        expect(listingQuery({ term: "a=b" })).toBe("q=a%3Db");
    });

    it("asks for events with room", () => {
        expect(listingQuery({ onlyWithSpace: true })).toBe("hasSpace=true");
    });

    // Not "hasSpace=false": the strip unfiltered is the whole strip, and the
    // request is smaller for it.
    it("leaves the room filter out rather than asking for its opposite", () => {
        expect(listingQuery({ onlyWithSpace: false })).toBe("");
    });

    it("asks for events starting within a window", () => {
        expect(listingQuery({ startingWithin: "30" })).toBe("startingWithin=30");
    });

    // The schema takes a positive number of minutes and rejects an empty
    // string, so "any time" has to be an absent parameter.
    it("leaves the window out when it is any time", () => {
        expect(listingQuery({ startingWithin: "" })).toBe("");
    });

    it("combines everything that is set", () => {
        expect(listingQuery({ term: "noir", onlyWithSpace: true, startingWithin: "60" })).toBe(
            "q=noir&hasSpace=true&startingWithin=60"
        );
    });
});

describe("whether anything would narrow the strip", () => {
    it("says no when nothing is set", () => {
        expect(narrows()).toBe(false);
        expect(narrows({ term: "   " })).toBe(false);
    });

    it("says yes for any one of them", () => {
        expect(narrows({ term: "noir" })).toBe(true);
        expect(narrows({ onlyWithSpace: true })).toBe(true);
        expect(narrows({ startingWithin: "30" })).toBe(true);
    });
});
