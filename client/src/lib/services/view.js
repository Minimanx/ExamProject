/**
 * Where to draw a car, given where it is in the world.
 *
 * The strip is wider than the screen, so a car's screen position is its world
 * position minus however far the view has scrolled. The movement loop keeps the
 * two in step as you drive — it scrolls when you approach an edge — and anything
 * that moves a car without driving it has to do the same arithmetic.
 *
 * `positionCorrection` did not. It only ever reduced the scroll, which is
 * harmless for the corrections driving produces: those are small and backwards,
 * because a refused move leaves the server holding a position behind the one the
 * client proposed. Joining a friend is neither small nor backwards — it is the
 * position of someone who may be right along the strip — and the old split left
 * the scroll where it was and set the screen position to the raw world x. The
 * car was drawn several screens past the right-hand edge, invisible, until
 * driving scrolled the view far enough to catch up with it.
 */

/**
 * How much room to leave between the car and the edge it was brought in from.
 *
 * The same distance the movement loop starts scrolling at, so a car that arrives
 * sits where a car that drove there would.
 */
export const KEEP_CLEAR = 150;

export function viewFor(worldX, { scroll, canvasLength, maxScroll }) {
    // The scrolls that leave the car on screen with room to spare. Expressed as
    // a range so an already-good view is left alone: a correction during
    // ordinary driving should not jerk the camera.
    const atLeast = worldX - Math.max(0, canvasLength - KEEP_CLEAR);
    const atMost = worldX - Math.min(KEEP_CLEAR, canvasLength);

    // A screen too narrow to hold both margins has no such range; showing the
    // car at all is the most that can be done.
    const wanted = atMost < atLeast ? atLeast : Math.min(Math.max(scroll, atLeast), atMost);

    const next = Math.min(Math.max(wanted, 0), maxScroll);
    return { scroll: next, x: worldX - next };
}
