/**
 * When a club next meets.
 *
 * A club that meets "Thursdays at 20:00 in Copenhagen" means 20:00 as read on a
 * Copenhagen clock. Stored as a UTC instant, that becomes 19:00 or 21:00 the
 * moment the clocks change, and every member is an hour wrong twice a year. The
 * schedule is therefore a wall clock and an IANA zone, and the instant is worked
 * out from them on demand.
 *
 * This is the same class of mistake as defect C2, and it would survive here for
 * the same reason: this codebase is developed at UTC+1, where a wrong
 * implementation looks right for half the year.
 */

const WEEKDAY_NAMES = [
    "Sundays",
    "Mondays",
    "Tuesdays",
    "Wednesdays",
    "Thursdays",
    "Fridays",
    "Saturdays",
];

/**
 * What a given instant reads as on a clock in `timeZone`.
 *
 * Intl is the only thing that knows the offset for a zone on a date, including
 * which side of a daylight-saving change it falls. Doing this arithmetically
 * with a fixed offset is the bug this module exists to avoid.
 */
function partsIn(instant, timeZone) {
    const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone,
        weekday: "short",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
    });

    const parts = Object.fromEntries(
        formatter.formatToParts(instant).map((part) => [part.type, part.value])
    );

    return {
        year: Number(parts.year),
        month: Number(parts.month),
        day: Number(parts.day),
        // Midnight can format as 24 rather than 00 in some environments.
        hour: Number(parts.hour) % 24,
        minute: Number(parts.minute),
        second: Number(parts.second),
        weekday: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday),
    };
}

/**
 * The instant at which a given wall-clock time occurs in a zone.
 *
 * There is no direct way to ask for this, so it is found by guessing UTC and
 * correcting by however far the guess landed off in that zone. Once corrected,
 * a second pass settles the case where the correction itself crossed a
 * daylight-saving boundary.
 */
function instantForWallClock({ year, month, day, hour, minute }, timeZone) {
    let guess = Date.UTC(year, month - 1, day, hour, minute, 0);

    for (let pass = 0; pass < 2; pass++) {
        const landed = partsIn(new Date(guess), timeZone);
        const landedAsUtc = Date.UTC(
            landed.year,
            landed.month - 1,
            landed.day,
            landed.hour,
            landed.minute,
            landed.second
        );
        const wantedAsUtc = Date.UTC(year, month - 1, day, hour, minute, 0);
        const drift = wantedAsUtc - landedAsUtc;

        if (drift === 0) break;
        guess += drift;
    }

    return new Date(guess);
}

/**
 * The next time this schedule comes round, at or after `from`.
 *
 * A meeting still to happen today counts; one that has already begun does not.
 */
export function nextOccurrence(schedule, from = new Date()) {
    const { weekday, hour, minute, timeZone } = schedule;
    const today = partsIn(from, timeZone);

    // How many days forward the next matching weekday is, today included.
    const daysAhead = (weekday - today.weekday + 7) % 7;

    for (const offset of [daysAhead, daysAhead + 7]) {
        // Built from the local date so that adding days crosses local midnight
        // rather than UTC midnight, which are not the same boundary.
        const candidateDay = new Date(Date.UTC(today.year, today.month - 1, today.day + offset));
        const candidate = instantForWallClock(
            {
                year: candidateDay.getUTCFullYear(),
                month: candidateDay.getUTCMonth() + 1,
                day: candidateDay.getUTCDate(),
                hour,
                minute,
            },
            timeZone
        );

        if (candidate.getTime() > from.getTime()) {
            return candidate;
        }
    }

    // Unreachable: the second candidate is always at least a week ahead.
    return null;
}

/** The schedule as a person would say it. */
export function describeSchedule(schedule) {
    if (schedule === null || schedule === undefined) {
        return "No regular meeting";
    }

    const { weekday, hour, minute, timeZone } = schedule;
    const clock = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    return `${WEEKDAY_NAMES[weekday]} at ${clock} (${timeZone})`;
}
