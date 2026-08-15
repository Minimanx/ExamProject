import { describe, it, expect } from "vitest";
import { bubbleShiftFor } from "./bubblePlacement.js";

// A speech bubble is centred on its car, which puts half of it off the screen
// when the car is near an edge — and the car spawns near the left edge, so that
// is the ordinary case rather than a corner one. The bubble slides back into
// view; the tail stays on the car.
const WIDTH = 200;
const STAGE = 1500;
const MARGIN = 8;

describe("bubbleShiftFor", () => {
    it("does not move a bubble that already fits", () => {
        expect(bubbleShiftFor({ carCentre: 750, bubbleWidth: WIDTH, stageWidth: STAGE })).toBe(0);
    });

    it("slides a bubble right when the car is near the left edge", () => {
        // Centred on 20 it would span -80..120; it needs to start at the margin.
        const shift = bubbleShiftFor({ carCentre: 20, bubbleWidth: WIDTH, stageWidth: STAGE });

        expect(20 - WIDTH / 2 + shift).toBeCloseTo(MARGIN);
    });

    it("slides a bubble left when the car is near the right edge", () => {
        const shift = bubbleShiftFor({ carCentre: 1490, bubbleWidth: WIDTH, stageWidth: STAGE });

        expect(1490 + WIDTH / 2 + shift).toBeCloseTo(STAGE - MARGIN);
    });

    it("never slides so far that the tail leaves the bubble", () => {
        // A bubble narrower than the shift would end up beside its own car.
        const shift = bubbleShiftFor({ carCentre: 0, bubbleWidth: 40, stageWidth: STAGE });

        expect(Math.abs(shift)).toBeLessThanOrEqual(20);
    });

    it("leaves a bubble wider than the stage alone rather than fighting itself", () => {
        expect(
            bubbleShiftFor({ carCentre: 750, bubbleWidth: STAGE + 100, stageWidth: STAGE })
        ).toBe(0);
    });

    it.each([
        ["a missing width", { carCentre: 20, bubbleWidth: 0, stageWidth: STAGE }],
        ["a missing stage", { carCentre: 20, bubbleWidth: WIDTH, stageWidth: 0 }],
    ])("stays put given %s, rather than jumping somewhere absurd", (_, input) => {
        expect(bubbleShiftFor(input)).toBe(0);
    });
});
