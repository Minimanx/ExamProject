/**
 * How far a car moves in one frame, given the keys held down.
 *
 * The movement loop used to apply the full step to each axis separately, so
 * holding two keys covered 1.414 times the distance of holding one. Diagonal was
 * a 41% speed boost — always wrong, and invisible until Phase 4 gave the server
 * a speed limit, at which point every diagonal frame proposed a move faster than
 * the world allows, was refused, and snapped the car back.
 *
 * Extracted from the component so the arithmetic can be tested. Whether a car
 * rubber-bands across the screen is not something a browser test notices
 * reliably, and it is exactly the kind of thing that stays broken for months.
 */
export function stepFor(keys, distance) {
    // Opposing keys cancel rather than fight, so holding both does nothing
    // instead of jittering by a subpixel each frame.
    const x = (keys.d ? 1 : 0) - (keys.a ? 1 : 0);
    const y = (keys.s ? 1 : 0) - (keys.w ? 1 : 0);

    const length = Math.hypot(x, y);
    if (length === 0) {
        return { dx: 0, dy: 0 };
    }

    // Normalised, so the step is the same length in every direction.
    return { dx: (x / length) * distance, dy: (y / length) * distance };
}
