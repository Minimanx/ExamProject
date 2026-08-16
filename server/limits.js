/**
 * The numbers that decide how much a host may do.
 *
 * These were three literals in three different kinds of place: `86400000`
 * written twice in a route body, `99` in both a validation rule and the message
 * describing it, and one-event-per-owner expressed as a unique index. Phase 8
 * turns them into the free/paid boundary, which is not possible while they are
 * scattered.
 *
 * Defaults reproduce the old behaviour exactly, so nothing changes until a
 * deployment sets one.
 */

function positiveInteger(env, name, fallback) {
    const raw = env[name];
    if (raw === undefined) {
        return fallback;
    }

    const value = Number(raw);
    // A misconfigured limit that quietly falls back to its default is worse
    // than one that refuses to start: the deployment looks healthy and behaves
    // as though the setting had never been written.
    if (!Number.isInteger(value) || value < 1) {
        throw new Error(`${name} must be a positive integer, got "${raw}"`);
    }
    return value;
}

export function readLimits(env = process.env) {
    return {
        schedulingWindowHours: positiveInteger(env, "MAX_SCHEDULING_WINDOW_HOURS", 24),
        maxSeats: positiveInteger(env, "MAX_SEATS", 99),
        maxEventsPerOwner: positiveInteger(env, "MAX_EVENTS_PER_OWNER", 1),
        // One hub instance holds this many players. Phase 11 turns "full" into
        // "allocate another" rather than a refusal; until then it is the cap on
        // how many people share a world.
        hubCapacity: positiveInteger(env, "HUB_CAPACITY", 60),
        // A mesh is every participant connected to every other, so cost grows
        // with the square of the group: five people is twenty streams, ten is
        // ninety. This is a product constraint rather than a tuning knob — the
        // roadmap picks a mesh precisely to avoid running media servers, and
        // that choice only holds at small numbers.
        voiceCapacity: positiveInteger(env, "VOICE_CAPACITY", 5),
    };
}

export const limits = readLimits();
