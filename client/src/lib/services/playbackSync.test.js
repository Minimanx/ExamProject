import { describe, it, expect } from "vitest";
import { targetPosition, correctionFor, SEEK_THRESHOLD_SECONDS } from "./playbackSync.js";

// The host says where the film is and when they said it. Everyone else works
// out where it should be *now* and steers their own player there. Getting this
// wrong is the difference between watching together and watching separately.
describe("targetPosition", () => {
    const updatedAt = 1_000_000;

    it("is exactly where the host said, while paused", () => {
        const state = { playing: false, positionSeconds: 42, updatedAt };

        expect(targetPosition(state, updatedAt + 30_000)).toBe(42);
    });

    // The message took time to arrive and more time may have passed since. A
    // client that jumped to the raw number would land wherever the film was
    // when the host pressed play, and stay behind by that much forever.
    it("accounts for the time since the host spoke, while playing", () => {
        const state = { playing: true, positionSeconds: 42, updatedAt };

        expect(targetPosition(state, updatedAt + 5000)).toBe(47);
    });

    it("does not run backwards for a message that arrives instantly", () => {
        const state = { playing: true, positionSeconds: 42, updatedAt };

        expect(targetPosition(state, updatedAt)).toBe(42);
    });
});

describe("correctionFor", () => {
    // A seek is visible: the picture jumps and the sound breaks. It is worth it
    // only for someone properly lost.
    it("seeks a viewer who is far behind", () => {
        const correction = correctionFor({ currentTime: 10, target: 100, playing: true });

        expect(correction).toEqual({ seekTo: 100, playbackRate: 1 });
    });

    it("seeks a viewer who is far ahead", () => {
        const correction = correctionFor({ currentTime: 100, target: 10, playing: true });

        expect(correction).toEqual({ seekTo: 10, playbackRate: 1 });
    });

    // Small drift is taken out by running slightly fast or slow, which nobody
    // can hear, rather than by a jump everybody sees.
    it("runs slightly fast for a viewer a little behind", () => {
        const correction = correctionFor({ currentTime: 99.5, target: 100, playing: true });

        expect(correction.seekTo).toBeNull();
        expect(correction.playbackRate).toBeGreaterThan(1);
    });

    it("runs slightly slow for a viewer a little ahead", () => {
        const correction = correctionFor({ currentTime: 100.5, target: 100, playing: true });

        expect(correction.seekTo).toBeNull();
        expect(correction.playbackRate).toBeLessThan(1);
    });

    it("leaves a viewer in step alone", () => {
        const correction = correctionFor({ currentTime: 100.02, target: 100, playing: true });

        expect(correction).toEqual({ seekTo: null, playbackRate: 1 });
    });

    // Nudging a paused film does nothing but leave the rate wrong for when it
    // resumes.
    it("never nudges while paused", () => {
        const correction = correctionFor({ currentTime: 100.5, target: 100, playing: false });

        expect(correction).toEqual({ seekTo: null, playbackRate: 1 });
    });

    it("still seeks a paused viewer who is in the wrong place", () => {
        const correction = correctionFor({ currentTime: 10, target: 100, playing: false });

        expect(correction).toEqual({ seekTo: 100, playbackRate: 1 });
    });

    it.each([
        [SEEK_THRESHOLD_SECONDS + 0.1, "seeks"],
        [SEEK_THRESHOLD_SECONDS - 0.1, "nudges"],
    ])("drift of %s %s", (drift, expected) => {
        const correction = correctionFor({ currentTime: 100 + drift, target: 100, playing: true });

        expect(correction.seekTo === null ? "nudges" : "seeks").toBe(expected);
    });

    // A rate correction has to end, or a viewer who caught up keeps going and
    // overshoots into a correction the other way.
    it("returns to normal speed once back in step", () => {
        const nudged = correctionFor({ currentTime: 99.5, target: 100, playing: true });
        const settled = correctionFor({ currentTime: 100, target: 100, playing: true });

        expect(nudged.playbackRate).not.toBe(1);
        expect(settled.playbackRate).toBe(1);
    });
});
