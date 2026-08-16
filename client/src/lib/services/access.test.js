import { describe, it, expect } from "vitest";
import { isLocked } from "./access.js";

/**
 * Whether an event needs something to get into.
 *
 * Two views answered this by reading `passwordBool`, the field lobby keys
 * replaced in Phase 3.3. Nothing writes it any more, so both silently answered
 * "no" for every event created since: the strip's marquee announced a private
 * showing as "Public Event", and the listing drew the unlocked icon beside it.
 *
 * Neither view was wrong when it was written, and no test failed when it became
 * wrong — the server tests still seed `passwordBool`, because the join route
 * genuinely still honours it for theaters made before the change.
 */
describe("whether an event is locked", () => {
    it("locks a private event", () => {
        expect(isLocked({ isPrivate: true })).toBe(true);
    });

    it("leaves a public event open", () => {
        expect(isLocked({ isPrivate: false })).toBe(false);
    });

    // The join route still accepts a password for these, and says so: they
    // expire within hours of their showing, and until the last one has, an
    // event that asks for something has to look like it.
    it("locks an event made before lobby keys existed", () => {
        expect(isLocked({ passwordBool: true })).toBe(true);
    });

    it("leaves an open event from before lobby keys open", () => {
        expect(isLocked({ passwordBool: false })).toBe(false);
    });

    it("treats an event carrying neither field as open", () => {
        expect(isLocked({})).toBe(false);
    });

    // The listing arrives over the network, and a row can be rendered before it
    // does. Guessing "locked" would put a padlock on the whole strip mid-load.
    it("treats a missing event as open rather than guessing", () => {
        expect(isLocked(null)).toBe(false);
        expect(isLocked(undefined)).toBe(false);
    });
});
