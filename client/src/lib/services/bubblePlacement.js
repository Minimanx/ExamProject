/**
 * How far a speech bubble slides to stay on screen.
 *
 * A bubble is centred on its car, so a car near an edge puts half of it outside
 * the world. That is not a corner case: the car spawns near the left edge, so a
 * player's first message is the one that gets cut in half.
 *
 * The bubble moves; the car and its tail do not. The shift is capped at half the
 * bubble's width so the tail always still has bubble above it — a bubble that
 * slid further would float beside the car it belongs to, which reads worse than
 * being slightly clipped.
 */

/** Clear of the very edge, so the border is visible rather than flush. */
const EDGE_MARGIN = 8;

export function bubbleShiftFor({ carCentre, bubbleWidth, stageWidth }) {
    if (!bubbleWidth || !stageWidth || bubbleWidth >= stageWidth) {
        return 0;
    }

    const half = bubbleWidth / 2;
    const left = carCentre - half;
    const right = carCentre + half;

    let shift = 0;
    if (left < EDGE_MARGIN) {
        shift = EDGE_MARGIN - left;
    } else if (right > stageWidth - EDGE_MARGIN) {
        shift = stageWidth - EDGE_MARGIN - right;
    }

    return Math.max(-half, Math.min(half, shift));
}
