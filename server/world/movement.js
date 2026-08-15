/**
 * Where a player actually is.
 *
 * The client used to be authoritative over its own position: it said where it
 * was and the server relayed that to everyone. Anything a client says about
 * itself is something a modified client can lie about, so a player could
 * teleport, move at any speed, or claim to be somewhere they were not.
 *
 * That stopped being cosmetic in Phase 3. Proximity chat decides who hears a
 * message from the server's copy of everyone's position, so a spoofed position
 * is a way to listen in on conversations across the world.
 *
 * The server keeps the position and treats what the client sends as a proposal,
 * accepted only when it could have been reached. See the Phase 4 plan for why
 * this rather than simulating movement server-side.
 */

/**
 * The world the client draws, described in the same numbers it uses.
 *
 * These have to match `InteractiveSpace.svelte` — the road runs from y=410 to
 * y=725 and the player moves at 250 px/s. If they drift apart, honest players
 * get corrected for driving normally, which is worse than the problem being
 * solved.
 */
export const WORLD = {
    minX: 0,
    minY: 410,
    maxY: 725,
    speedPerSecond: 250,
};

/**
 * How much faster than the limit a move may be before it is refused.
 *
 * Frames are uneven, packets arrive late and clocks are not the same. A limit
 * with no slack rejects honest players constantly, which is a worse outcome than
 * a cheat managing to move a fraction too fast.
 */
const SPEED_TOLERANCE = 1.35;

/**
 * How much unspent travel time a player may carry forward.
 *
 * The limit is a budget over time, and a client's frames never line up with the
 * server's clock. The first report after joining is the worst case: the server
 * stamped its arrival, the client had already been integrating frames locally,
 * and the difference is charged against a budget that has barely begun to
 * accrue. A slow connection has the same shape — fewer reports, each covering
 * more ground.
 *
 * Charging only for the time a movement actually needed lets the unused
 * remainder carry over, which absorbs that jitter. Capping the carry-over is
 * what stops it becoming a stored teleport: stand still for a minute and you
 * still have only this much saved up — a second's worth, which is a third of
 * one theater lot, not a way across the world.
 */
const MAX_BANKED_SECONDS = 1;

/** Whether a proposal is even a pair of coordinates. */
function isPosition(value) {
    return (
        typeof value?.x === "number" &&
        typeof value?.y === "number" &&
        Number.isFinite(value.x) &&
        Number.isFinite(value.y)
    );
}

function isInsideWorld({ x, y }) {
    return x >= WORLD.minX && y >= WORLD.minY && y <= WORLD.maxY;
}

/**
 * Decide where a player is, given where they were and where they say they are.
 *
 * Returns the position the server will keep either way, so a refused client can
 * be told where it actually is rather than drifting away unaware.
 *
 * `from` is null for someone's first move, which is accepted wherever they land
 * inside the world: there is no previous position to measure travel from, and
 * the join itself decides where they start.
 */
export function acceptMove(from, proposed, now) {
    if (!isPosition(proposed) || !isInsideWorld(proposed)) {
        return { accepted: false, position: from };
    }

    if (from === null) {
        // Arriving with a full bank rather than an empty one. Someone who has
        // just joined has not been moving, so by definition they have earned the
        // whole carry-over — and starting them at zero made their very first
        // report the one most likely to be refused, which snaps the car back to
        // the spawn point in front of a brand new player.
        return {
            accepted: true,
            position: { x: proposed.x, y: proposed.y, at: now - MAX_BANKED_SECONDS * 1000 },
        };
    }

    // The stamp is the server's own clock, so this is not a client lying about
    // time — it is a reordered or duplicated message, which cannot be allowed to
    // make the travel budget negative.
    //
    // `from.at` is the moment up to which travel has been paid for, not the last
    // time a message arrived. Clamping it forward is what bounds the carry-over.
    const bankedFrom = Math.max(from.at, now - MAX_BANKED_SECONDS * 1000);
    const elapsedSeconds = (now - bankedFrom) / 1000;
    if (elapsedSeconds < 0) {
        return { accepted: false, position: from };
    }

    const travelled = Math.hypot(proposed.x - from.x, proposed.y - from.y);
    const allowed = WORLD.speedPerSecond * elapsedSeconds * SPEED_TOLERANCE;

    if (travelled > allowed) {
        return { accepted: false, position: from };
    }

    // Charged for the time this movement needed rather than everything elapsed,
    // so an unspent remainder carries forward and covers the next late report.
    const spentSeconds = travelled / (WORLD.speedPerSecond * SPEED_TOLERANCE);
    return {
        accepted: true,
        position: { x: proposed.x, y: proposed.y, at: bankedFrom + spentSeconds * 1000 },
    };
}
