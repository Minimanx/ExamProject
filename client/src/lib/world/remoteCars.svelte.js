/**
 * Everyone else's car, and what they are saying.
 *
 * This lived as seven near-identical handlers in the scene component, each one
 * opening with the same guard, doing a `findIndex`, and ending in a `cars = cars`
 * left over from Svelte 4. It is the only state in the app that is driven
 * entirely by socket traffic, and it had no tests of its own — the nearest thing
 * was an end-to-end test that drove two browsers and looked at the screen.
 *
 * Nothing here knows about sockets or about the user. The scene decides which
 * events to listen for and when to ignore them; this decides what the world
 * looks like once it has.
 */

/** Where a car goes when its position arrives unusable. The player spawn. */
const FALLBACK = { x: 60, y: 600 };

/** How long a speech bubble stays over a car. */
export const BUBBLE_LIFETIME_MS = 6000;

export function createRemoteCars() {
    let cars = $state([]);

    // Keyed by the speaker's socket id. One per car: a second message replaces
    // the first rather than stacking, which is what a bubble over a car can
    // actually show.
    let bubbles = $state({});

    // A plain object, not $state: these are timer handles, never read by the
    // markup, and nothing should re-render when one changes.
    const bubbleTimers = {};

    function indexOf(id) {
        return cars.findIndex((car) => car.id === id);
    }

    return {
        get cars() {
            return cars;
        },
        get bubbles() {
            return bubbles;
        },

        /**
         * A car has come into view.
         *
         * Ignored if it is already here: the server announces a car to both
         * sides when they come into view of each other, and a reconnect can
         * repeat one.
         */
        add({ id, coords, color, name, screen }) {
            if (indexOf(id) !== -1) return;

            cars.push({
                id,
                color,
                name,
                coords: {
                    x: Number.isFinite(coords?.x + screen) ? coords.x + screen : FALLBACK.x,
                    y: Number.isFinite(coords?.y) ? coords.y : FALLBACK.y,
                },
            });
        },

        /**
         * A car has moved.
         *
         * A position for a car that is not here is dropped rather than creating
         * one. Arrival is its own event, and a car conjured from a position
         * would have no colour or name to draw.
         */
        move({ id, coords, direction, screen }) {
            const at = indexOf(id);
            if (at === -1) return;

            cars[at] = {
                ...cars[at],
                coords: { x: coords.x + screen, y: coords.y, direction },
            };
        },

        remove({ id }) {
            const at = indexOf(id);
            if (at === -1) return;

            cars.splice(at, 1);
        },

        recolor({ id, color }) {
            const at = indexOf(id);
            if (at === -1) return;

            cars[at].color = color;
        },

        rename({ id, name, color }) {
            const at = indexOf(id);
            if (at === -1) return;

            cars[at].name = name;
            cars[at].color = color;
        },

        /** Put a speech bubble over a car for a few seconds. */
        say({ id, text }) {
            bubbles[id] = text;

            // A second message from the same car replaces the first and restarts
            // its clock, rather than the earlier timer clearing the newer bubble.
            clearTimeout(bubbleTimers[id]);
            bubbleTimers[id] = setTimeout(() => {
                delete bubbles[id];
                delete bubbleTimers[id];
            }, BUBBLE_LIFETIME_MS);
        },

        /**
         * Let go of everything, including the timers.
         *
         * One per bubble still on screen. Left running, each fires into a
         * component that no longer exists when its six seconds are up.
         */
        clear() {
            for (const id of Object.keys(bubbleTimers)) {
                clearTimeout(bubbleTimers[id]);
                delete bubbleTimers[id];
            }
            bubbles = {};
            cars = [];
        },
    };
}
