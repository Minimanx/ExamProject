/**
 * Who is near whom, without asking everyone.
 *
 * Interest management means a position update goes only to players close enough
 * to see it, which needs "who is near this player" answered on every update.
 * Comparing against every other player is O(n²) per tick — exactly the cost this
 * phase exists to remove — so positions go into a uniform grid and a query reads
 * only the cells around the subject.
 *
 * At the numbers this runs at today the difference is irrelevant. The point is
 * that the shape does not have to change when it stops being.
 */

export class SpatialGrid {
    #cellSize;
    #cells = new Map();
    #cellOfMember = new Map();

    /**
     * Candidates the last query considered.
     *
     * Exposed so a test can assert the query did not walk the whole world, which
     * is the entire reason for the grid and is otherwise invisible: a scan
     * returns exactly the same answers, only slower.
     */
    lastQueryCandidates = 0;

    constructor({ cellSize }) {
        this.#cellSize = cellSize;
    }

    #keyFor(x, y) {
        return `${Math.floor(x / this.#cellSize)}:${Math.floor(y / this.#cellSize)}`;
    }

    place(id, { x, y }) {
        const key = this.#keyFor(x, y);
        const previous = this.#cellOfMember.get(id);

        if (previous !== undefined && previous.key !== key) {
            // Moved, not copied: leaving the old cell populated would report
            // this player in two places at once, forever.
            this.#cells.get(previous.key)?.delete(id);
        }

        if (!this.#cells.has(key)) {
            this.#cells.set(key, new Set());
        }
        this.#cells.get(key).add(id);
        this.#cellOfMember.set(id, { key, x, y });
    }

    remove(id) {
        const previous = this.#cellOfMember.get(id);
        if (previous === undefined) return;

        this.#cells.get(previous.key)?.delete(id);
        this.#cellOfMember.delete(id);
    }

    positionOf(id) {
        const entry = this.#cellOfMember.get(id);
        return entry === undefined ? null : { x: entry.x, y: entry.y };
    }

    /**
     * Everyone within `radius` of a point, optionally excluding one id.
     *
     * The cells are a filter, not the answer. Someone in a neighbouring cell can
     * be well inside the radius and someone in the same cell can be outside it,
     * so the distance is still measured — diagonally, since per-axis would make
     * a square of a circle.
     */
    near({ x, y }, radius, excludeId = null) {
        const reach = Math.ceil(radius / this.#cellSize);
        const centreX = Math.floor(x / this.#cellSize);
        const centreY = Math.floor(y / this.#cellSize);
        const found = [];
        this.lastQueryCandidates = 0;

        for (let cellX = centreX - reach; cellX <= centreX + reach; cellX++) {
            for (let cellY = centreY - reach; cellY <= centreY + reach; cellY++) {
                const members = this.#cells.get(`${cellX}:${cellY}`);
                if (members === undefined) continue;

                for (const id of members) {
                    if (id === excludeId) continue;

                    this.lastQueryCandidates++;
                    const at = this.#cellOfMember.get(id);
                    if (Math.hypot(at.x - x, at.y - y) <= radius) {
                        found.push(id);
                    }
                }
            }
        }

        return found;
    }
}
