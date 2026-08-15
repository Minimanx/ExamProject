import { describe, it, expect } from "vitest";
import { stepFor } from "./driving.js";

// Pressing two keys used to apply the full step on each axis, so driving
// diagonally covered 1.414x the distance of driving straight. That was always
// wrong — diagonal should not be a speed boost — and Phase 4's server-side speed
// limit turned it into a visible fault: every diagonal frame proposed a move
// faster than the world allows, was refused, and snapped the car back.
const STEP = 10;

function magnitude({ dx, dy }) {
    return Math.hypot(dx, dy);
}

describe("stepFor", () => {
    it.each([
        ["w", { w: true }],
        ["s", { s: true }],
        ["a", { a: true }],
        ["d", { d: true }],
    ])("moves a full step for %s alone", (_, keys) => {
        expect(magnitude(stepFor(keys, STEP))).toBeCloseTo(STEP);
    });

    // The bug, stated as a rule: two keys must not cover more ground than one.
    it.each([
        ["up and right", { w: true, d: true }],
        ["up and left", { w: true, a: true }],
        ["down and right", { s: true, d: true }],
        ["down and left", { s: true, a: true }],
    ])("covers the same distance going %s", (_, keys) => {
        expect(magnitude(stepFor(keys, STEP))).toBeCloseTo(STEP);
    });

    it("still moves diagonally, not just on one axis", () => {
        const step = stepFor({ w: true, d: true }, STEP);

        expect(step.dx).toBeGreaterThan(0);
        expect(step.dy).toBeLessThan(0);
        expect(Math.abs(step.dx)).toBeCloseTo(Math.abs(step.dy));
    });

    it("goes nowhere when nothing is pressed", () => {
        expect(stepFor({}, STEP)).toEqual({ dx: 0, dy: 0 });
    });

    // Holding both directions on one axis is a cancellation, not a jitter.
    it.each([
        ["left and right", { a: true, d: true }, "dx"],
        ["up and down", { w: true, s: true }, "dy"],
    ])("cancels %s", (_, keys, axis) => {
        expect(stepFor(keys, STEP)[axis]).toBe(0);
    });

    it("moves a full step on the other axis while one cancels", () => {
        const step = stepFor({ a: true, d: true, w: true }, STEP);

        expect(step.dx).toBe(0);
        expect(step.dy).toBeCloseTo(-STEP);
    });

    it("goes nowhere when everything is pressed", () => {
        expect(magnitude(stepFor({ w: true, a: true, s: true, d: true }, STEP))).toBeCloseTo(0);
    });

    // The server rejects anything faster than the world's speed, with a little
    // slack for frame timing. A step that is exactly the budget must not be at
    // the very edge of it.
    it("never proposes more than the step it was given", () => {
        const everyCombination = [true, false].flatMap((w) =>
            [true, false].flatMap((a) =>
                [true, false].flatMap((s) => [true, false].map((d) => ({ w, a, s, d })))
            )
        );

        for (const keys of everyCombination) {
            expect(magnitude(stepFor(keys, STEP))).toBeLessThanOrEqual(STEP + 0.0001);
        }
    });
});
