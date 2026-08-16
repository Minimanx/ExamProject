import { describe, it, expect } from "vitest";
import { randomPlayerColor } from "./playerColor.js";

const HEX = /^#[0-9a-f]{6}$/;

describe("a colour for a new player", () => {
    // The bug: leading zeroes were dropped, so a low value came out as #ff8a.
    it("pads a value that would otherwise be too short", () => {
        expect(randomPlayerColor(() => 0)).toBe("#000000");
        expect(randomPlayerColor(() => 255 / 0x1000000)).toBe("#0000ff");
    });

    it("reaches white, which the old bound excluded", () => {
        expect(randomPlayerColor(() => (0x1000000 - 1) / 0x1000000)).toBe("#ffffff");
    });

    // The old version failed this about 6.4% of the time.
    it("is always a hex colour, whatever the draw", () => {
        for (let i = 0; i < 20000; i++) {
            expect(randomPlayerColor()).toMatch(HEX);
        }
    });

    it("covers the low values that used to come out short", () => {
        for (let value = 0; value < 0x100000; value += 0x1111) {
            expect(randomPlayerColor(() => value / 0x1000000)).toMatch(HEX);
        }
    });
});
