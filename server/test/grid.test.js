import { describe, it, expect } from "vitest";
import { SpatialGrid } from "../world/grid.js";

// Phase 4 exit criterion: a client only receives position updates for players it
// can see. Answering "who is near this player" on every position update by
// comparing against every other player is O(n²) per tick — precisely the cost
// this phase exists to avoid — so positions live in a uniform grid and a query
// reads the cells around the subject.
//
// At today's numbers the difference is irrelevant. The point is that the shape
// does not have to change when it stops being irrelevant.
describe("SpatialGrid", () => {
    const radius = 450;

    it("finds nobody in an empty world", () => {
        const grid = new SpatialGrid({ cellSize: radius });

        expect(grid.near({ x: 0, y: 0 }, radius)).toEqual([]);
    });

    it("finds someone standing on the same spot", () => {
        const grid = new SpatialGrid({ cellSize: radius });
        grid.place("a", { x: 100, y: 600 });

        expect(grid.near({ x: 100, y: 600 }, radius)).toEqual(["a"]);
    });

    it("finds someone within the radius", () => {
        const grid = new SpatialGrid({ cellSize: radius });
        grid.place("a", { x: 100, y: 600 });

        expect(grid.near({ x: 400, y: 600 }, radius)).toEqual(["a"]);
    });

    it("does not find someone beyond it", () => {
        const grid = new SpatialGrid({ cellSize: radius });
        grid.place("a", { x: 100, y: 600 });

        expect(grid.near({ x: 2000, y: 600 }, radius)).toEqual([]);
    });

    // A cell is a bucket, not the answer. Someone in a neighbouring cell can be
    // well inside the radius, and someone in the same cell can be outside it —
    // so the distance still has to be checked.
    it("finds someone in a neighbouring cell who is close enough", () => {
        const grid = new SpatialGrid({ cellSize: 100 });
        grid.place("a", { x: 199, y: 600 });

        expect(grid.near({ x: 201, y: 600 }, radius)).toEqual(["a"]);
    });

    it("rejects someone in the same cell who is too far", () => {
        const grid = new SpatialGrid({ cellSize: 10_000 });
        grid.place("a", { x: 0, y: 600 });

        expect(grid.near({ x: 9000, y: 600 }, radius)).toEqual([]);
    });

    it("measures distance diagonally", () => {
        const grid = new SpatialGrid({ cellSize: radius });
        // 400 on each axis is 566 apart, past a 450 radius.
        grid.place("a", { x: 400, y: 400 });

        expect(grid.near({ x: 0, y: 0 }, radius)).toEqual([]);
    });

    it("moves someone rather than leaving a copy behind", () => {
        const grid = new SpatialGrid({ cellSize: radius });
        grid.place("a", { x: 100, y: 600 });

        grid.place("a", { x: 5000, y: 600 });

        expect(grid.near({ x: 100, y: 600 }, radius)).toEqual([]);
        expect(grid.near({ x: 5000, y: 600 }, radius)).toEqual(["a"]);
    });

    it("forgets someone who has left", () => {
        const grid = new SpatialGrid({ cellSize: radius });
        grid.place("a", { x: 100, y: 600 });

        grid.remove("a");

        expect(grid.near({ x: 100, y: 600 }, radius)).toEqual([]);
    });

    it("is untroubled by removing someone who was never there", () => {
        const grid = new SpatialGrid({ cellSize: radius });

        expect(() => grid.remove("ghost")).not.toThrow();
    });

    it("leaves the subject out of their own neighbours", () => {
        const grid = new SpatialGrid({ cellSize: radius });
        grid.place("a", { x: 100, y: 600 });
        grid.place("b", { x: 120, y: 600 });

        expect(grid.near({ x: 100, y: 600 }, radius, "a")).toEqual(["b"]);
    });

    it("finds everyone nearby, not just the first", () => {
        const grid = new SpatialGrid({ cellSize: radius });
        grid.place("a", { x: 100, y: 600 });
        grid.place("b", { x: 120, y: 600 });
        grid.place("c", { x: 140, y: 600 });

        expect(grid.near({ x: 110, y: 600 }, radius).sort()).toEqual(["a", "b", "c"]);
    });

    // The reason for the grid at all: a query must not walk everyone in the
    // world. With cells the size of the radius, a query reads nine of them
    // however many people are elsewhere.
    it("does not look at players far outside the query", () => {
        const grid = new SpatialGrid({ cellSize: radius });
        for (let i = 0; i < 1000; i++) {
            grid.place(`far-${i}`, { x: 100_000 + i, y: 600 });
        }
        grid.place("near", { x: 100, y: 600 });

        const inspected = grid.near({ x: 100, y: 600 }, radius);

        expect(inspected).toEqual(["near"]);
        expect(grid.lastQueryCandidates).toBeLessThan(10);
    });
});
