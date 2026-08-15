import { describe, it, expect } from "vitest";
import { viewFor, KEEP_CLEAR } from "./view.js";

/**
 * The world is wider than the screen, so where a car is drawn is a world
 * position minus however far the view has scrolled. The movement loop keeps
 * those two in step as you drive; anything that moves a car without driving it
 * has to do the same arithmetic, and `positionCorrection` did not.
 *
 * Driving corrections are small and backwards, so nothing looked wrong. Joining
 * a friend is neither: it sends the position of someone who may be right along
 * the strip, and the old split left the scroll where it was and put the car at
 * the raw world x — several screens off the right-hand edge, invisible, until
 * you drove far enough for the scroll to catch up.
 */
const SCREEN = { canvasLength: 1000, maxScroll: 5000 };

describe("splitting a world position into a view", () => {
    it("leaves the view alone when the car is already on screen", () => {
        const view = viewFor(700, { scroll: 300, ...SCREEN });

        expect(view).toEqual({ scroll: 300, x: 400 });
    });

    // The bug: a friend parked far along the strip.
    it("scrolls forward to a car that would otherwise be off the right edge", () => {
        const view = viewFor(3000, { scroll: 0, ...SCREEN });

        expect(view.x).toBeGreaterThanOrEqual(0);
        expect(view.x).toBeLessThanOrEqual(SCREEN.canvasLength - KEEP_CLEAR);
        expect(view.scroll + view.x).toBe(3000);
    });

    it("scrolls back to a car that would otherwise be off the left edge", () => {
        const view = viewFor(200, { scroll: 4000, ...SCREEN });

        expect(view.x).toBeGreaterThanOrEqual(0);
        expect(view.scroll + view.x).toBe(200);
    });

    // The scroll is what the world is drawn at, so a value outside its range
    // would show bare background past the end of the strip.
    it("never scrolls past the end of the world", () => {
        const view = viewFor(9000, { scroll: 0, ...SCREEN });

        expect(view.scroll).toBe(SCREEN.maxScroll);
    });

    it("never scrolls before the start of the world", () => {
        const view = viewFor(0, { scroll: 500, ...SCREEN });

        expect(view.scroll).toBe(0);
        expect(view.x).toBe(0);
    });

    // A world no wider than the screen has nowhere to scroll to, and the car is
    // simply where it is.
    it("does not scroll a world that fits on screen", () => {
        const view = viewFor(600, { scroll: 0, canvasLength: 1000, maxScroll: 0 });

        expect(view).toEqual({ scroll: 0, x: 600 });
    });

    // Whatever else it does, the two halves have to add back up — that is the
    // one thing the caller relies on.
    it("always splits the position it was given", () => {
        for (const worldX of [0, 137, 999, 1000, 4321, 12000]) {
            for (const scroll of [0, 250, 5000]) {
                const view = viewFor(worldX, { scroll, ...SCREEN });
                expect(view.scroll + view.x).toBe(worldX);
            }
        }
    });
});
