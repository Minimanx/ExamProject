import { describe, it, expect } from "vitest";
import { invitedSlot } from "./invite.js";

const params = (query) => new URLSearchParams(query);

const LISTING = [
    { _id: "aaaaaaaaaaaaaaaaaaaaaaaa", position: 0 },
    { _id: "bbbbbbbbbbbbbbbbbbbbbbbb", position: 4 },
];

const SLOTS = 6;

describe("where an invite link is asking to go", () => {
    it("goes nowhere without a link that asks", () => {
        expect(invitedSlot(params(""), LISTING, SLOTS)).toBe(null);
    });

    // The private invite. It carries the event and its one-time key, and used
    // to leave the recipient at the spawn to find the marquee themselves.
    it("finds the slot of the event a private invite names", () => {
        expect(
            invitedSlot(params("theater=bbbbbbbbbbbbbbbbbbbbbbbb&key=abc"), LISTING, SLOTS)
        ).toBe(4);
    });

    it("goes nowhere when the event has closed since the link was sent", () => {
        expect(invitedSlot(params("theater=cccccccccccccccccccccccc"), LISTING, SLOTS)).toBe(null);
    });

    it("follows a position link", () => {
        expect(invitedSlot(params("position=3"), LISTING, SLOTS)).toBe(3);
    });

    it("stops at the end of the world for a stale position", () => {
        expect(invitedSlot(params("position=99"), LISTING, SLOTS)).toBe(5);
    });

    // A hand-edited URL. NaN propagated through the teleport into the player's
    // own position, and every step after it is NaN plus a distance — the car
    // never comes back without a reload.
    it("ignores a position that is not a number", () => {
        expect(invitedSlot(params("position=abc"), LISTING, SLOTS)).toBe(null);
        expect(invitedSlot(params("position="), LISTING, SLOTS)).toBe(null);
    });

    it("ignores a negative position rather than driving off the left edge", () => {
        expect(invitedSlot(params("position=-5"), LISTING, SLOTS)).toBe(null);
    });

    it("ignores a fractional position", () => {
        expect(invitedSlot(params("position=1.5"), LISTING, SLOTS)).toBe(null);
    });

    // Both would only appear together by hand, and the named event is the more
    // specific request.
    it("prefers the named event when a link carries both", () => {
        expect(
            invitedSlot(params("theater=aaaaaaaaaaaaaaaaaaaaaaaa&position=3"), LISTING, SLOTS)
        ).toBe(0);
    });

    it("is untroubled by an empty strip", () => {
        expect(invitedSlot(params("theater=aaaaaaaaaaaaaaaaaaaaaaaa"), [], 3)).toBe(null);
    });
});
