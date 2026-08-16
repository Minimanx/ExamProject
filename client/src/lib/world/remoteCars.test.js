import { describe, it, expect, vi, afterEach } from "vitest";
import { createRemoteCars, BUBBLE_LIFETIME_MS } from "./remoteCars.svelte.js";

/**
 * The world as this client sees it, driven entirely by socket traffic.
 *
 * Until this was pulled out of the scene component it had no tests at all: the
 * nearest thing was an end-to-end test that drove two browsers and looked at the
 * screen, which is a slow and indirect way to ask whether a car that leaves is
 * removed.
 */
afterEach(() => {
    vi.useRealTimers();
});

const arriving = (id, x, name = "someone") => ({
    id,
    coords: { x, y: 600 },
    screen: 0,
    color: "#fff",
    name,
});

describe("cars coming and going", () => {
    it("adds a car that comes into view", () => {
        const world = createRemoteCars();

        world.add(arriving("a", 100));

        expect(world.cars).toHaveLength(1);
        expect(world.cars[0]).toMatchObject({ id: "a", coords: { x: 100, y: 600 } });
    });

    // The server announces a car to both sides at once, and a reconnect can
    // repeat one. Two entries for one car draws it twice.
    it("does not add the same car twice", () => {
        const world = createRemoteCars();

        world.add(arriving("a", 100));
        world.add(arriving("a", 100));

        expect(world.cars).toHaveLength(1);
    });

    it("adds the screen offset, so cars from different scroll positions line up", () => {
        const world = createRemoteCars();

        world.add({ ...arriving("a", 40), screen: 900 });

        expect(world.cars[0].coords.x).toBe(940);
    });

    // A position arrives as two numbers that are added together, and either can
    // be missing. Drawing at NaN puts the car nowhere at all.
    it("falls back to the spawn point when a position makes no sense", () => {
        const world = createRemoteCars();

        world.add({ id: "a", coords: undefined, screen: 0, color: "#fff", name: "x" });

        expect(world.cars[0].coords).toEqual({ x: 60, y: 600 });
    });

    it("removes a car that leaves", () => {
        const world = createRemoteCars();
        world.add(arriving("a", 100));
        world.add(arriving("b", 200));

        world.remove({ id: "a" });

        expect(world.cars.map((car) => car.id)).toEqual(["b"]);
    });

    it("is untroubled by a car leaving that was never here", () => {
        const world = createRemoteCars();
        world.add(arriving("a", 100));

        expect(() => world.remove({ id: "ghost" })).not.toThrow();
        expect(world.cars).toHaveLength(1);
    });
});

describe("cars moving and changing", () => {
    it("moves a car, keeping which way it faces", () => {
        const world = createRemoteCars();
        world.add(arriving("a", 100));

        world.move({ id: "a", coords: { x: 50, y: 601 }, direction: true, screen: 200 });

        expect(world.cars[0].coords).toEqual({ x: 250, y: 601, direction: true });
    });

    it("keeps the car's colour and name when it moves", () => {
        const world = createRemoteCars();
        world.add(arriving("a", 100, "Wanda"));

        world.move({ id: "a", coords: { x: 0, y: 600 }, direction: false, screen: 0 });

        expect(world.cars[0]).toMatchObject({ name: "Wanda", color: "#fff" });
    });

    // Interest management means positions arrive only for cars in view, but a
    // position can still cross with the carLeft that removed one.
    it("does not conjure a car out of a position", () => {
        const world = createRemoteCars();

        world.move({ id: "ghost", coords: { x: 0, y: 600 }, direction: false, screen: 0 });

        expect(world.cars).toEqual([]);
    });

    it("repaints only the car that changed", () => {
        const world = createRemoteCars();
        world.add(arriving("a", 100));
        world.add(arriving("b", 200));

        world.recolor({ id: "b", color: "#ff0000" });

        expect(world.cars.map((car) => car.color)).toEqual(["#fff", "#ff0000"]);
    });

    it("renames a car", () => {
        const world = createRemoteCars();
        world.add(arriving("a", 100, "Old"));

        world.rename({ id: "a", name: "New", color: "#00ff00" });

        expect(world.cars[0]).toMatchObject({ name: "New", color: "#00ff00" });
    });
});

describe("speech bubbles", () => {
    it("puts a bubble over the car that spoke", () => {
        const world = createRemoteCars();

        world.say({ id: "a", text: "anyone up for Solaris?" });

        expect(world.bubbles).toEqual({ a: "anyone up for Solaris?" });
    });

    it("clears a bubble once its time is up", () => {
        vi.useFakeTimers();
        const world = createRemoteCars();

        world.say({ id: "a", text: "first" });
        vi.advanceTimersByTime(BUBBLE_LIFETIME_MS + 1);

        expect(world.bubbles).toEqual({});
    });

    // The earlier message's timer must not take the newer bubble down with it.
    it("restarts the clock when the same car speaks again", () => {
        vi.useFakeTimers();
        const world = createRemoteCars();

        world.say({ id: "a", text: "first" });
        vi.advanceTimersByTime(BUBBLE_LIFETIME_MS - 100);
        world.say({ id: "a", text: "second" });
        vi.advanceTimersByTime(200);

        expect(world.bubbles).toEqual({ a: "second" });
    });

    it("keeps one bubble per car", () => {
        const world = createRemoteCars();

        world.say({ id: "a", text: "hello" });
        world.say({ id: "b", text: "hello back" });

        expect(world.bubbles).toEqual({ a: "hello", b: "hello back" });
    });

    // Each pending timer fires into a component that is gone by then.
    it("cancels pending bubble timers when the world is let go", () => {
        vi.useFakeTimers();
        const world = createRemoteCars();
        world.say({ id: "a", text: "still up" });

        world.clear();
        vi.advanceTimersByTime(BUBBLE_LIFETIME_MS + 1);

        expect(vi.getTimerCount()).toBe(0);
        expect(world.bubbles).toEqual({});
        expect(world.cars).toEqual([]);
    });
});
