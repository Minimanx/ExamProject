/**
 * Keeping every viewer's player on the same frame.
 *
 * The host says where the film is and when they said it. Each viewer works out
 * where it should be *now* and steers their own player there. None of the film
 * goes anywhere — only these numbers do.
 */

/**
 * How far out of step a viewer may drift before a seek is worth it.
 *
 * A seek is visible: the picture jumps and the sound breaks. It earns that only
 * for someone properly lost.
 */
export const SEEK_THRESHOLD_SECONDS = 1.5;

/** Below this, the drift is not worth touching at all. */
const NUDGE_THRESHOLD_SECONDS = 0.15;

/** How much faster or slower to run while catching up. Inaudible at this size. */
const NUDGE_RATE = 0.05;

/**
 * Where the film should be at `now`.
 *
 * The message took time to arrive, and more time may have passed since it did.
 * Using the raw number would leave a viewer permanently behind by however long
 * that took.
 */
export function targetPosition({ playing, positionSeconds, updatedAt }, now = Date.now()) {
    if (!playing) {
        return positionSeconds;
    }
    return positionSeconds + Math.max(0, now - updatedAt) / 1000;
}

/**
 * What to do about the gap between where a viewer is and where they should be.
 *
 * Returns a seek target, or a playback rate to close the gap quietly. A paused
 * film is never nudged — it would do nothing except leave the rate wrong for
 * when it resumes.
 */
export function correctionFor({ currentTime, target, playing }) {
    const drift = currentTime - target;

    if (Math.abs(drift) > SEEK_THRESHOLD_SECONDS) {
        return { seekTo: target, playbackRate: 1 };
    }

    if (playing && Math.abs(drift) > NUDGE_THRESHOLD_SECONDS) {
        // Behind runs a little fast, ahead a little slow. It ends by itself:
        // once back inside the threshold the rate returns to 1, so a viewer who
        // caught up does not keep going and overshoot the other way.
        return { seekTo: null, playbackRate: drift < 0 ? 1 + NUDGE_RATE : 1 - NUDGE_RATE };
    }

    return { seekTo: null, playbackRate: 1 };
}
