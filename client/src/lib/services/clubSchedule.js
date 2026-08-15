/**
 * A club's recurring meeting, as a reader should see it.
 *
 * The schedule is stated in the club's own timezone, which is what makes
 * "Tuesdays at 19:30" mean the same thing after the clocks change. Naming that
 * zone is essential when it is not the reader's and noise when it is: a
 * Copenhagen reader learns nothing from "(Europe/Copenhagen)" and pays a line of
 * wrapping for it.
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

export function describeMeeting(schedule, readerTimeZone) {
    if (schedule === null || schedule === undefined) {
        return "No regular meeting";
    }

    const { weekday, hour, minute, timeZone } = schedule;
    const clock = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    const when = `${WEEKDAY_NAMES[weekday]} at ${clock}`;

    // An unknown reader zone means the zone cannot be dismissed as redundant,
    // so it is shown — being told something obvious beats being told nothing.
    return readerTimeZone === timeZone ? when : `${when} (${timeZone})`;
}
