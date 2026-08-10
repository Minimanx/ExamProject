/**
 * Render a span of milliseconds as `hh:mm:ss`.
 *
 * The three countdowns in InsideTheater.svelte each did this by constructing
 * `new Date(duration)` — a moment that many milliseconds after the epoch — and
 * reading getHours(), getMinutes() and getSeconds() off it. Those are
 * local-time accessors, so the viewer's UTC offset was silently added to the
 * answer, and a hardcoded `- 3600000` subtracted an hour to cancel it. That
 * cancels exactly once: in CET during winter. Every other zone, and CET itself
 * from March to October, read an hour out. See defect C2.
 *
 * A duration is arithmetic, not a point in time, so no Date is involved here.
 */
export function formatDuration(milliseconds) {
    // Callers subtract two timestamps, and the losing side of that subtraction
    // is negative for a render frame or so around the boundary.
    const total = Math.max(0, Math.floor(milliseconds / 1000));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor(total / 60) % 60;
    const seconds = total % 60;

    return [hours, minutes, seconds].map((part) => String(part).padStart(2, "0")).join(":");
}

/**
 * Render an instant as a time of day, the way the viewer expects to read it.
 *
 * Times are stored in UTC and this is where they become local. The two places
 * that showed a theater's start time each spelled out `getHours()`,
 * `getMinutes()` and their own zero padding inline, and always produced
 * 24-hour: a viewer who expects 8:30 PM saw 20:30.
 *
 * `locale` and `timeZone` are parameters so this can be tested from more than
 * one place on Earth; in the app both default to the browser's own.
 */
export function formatTimeOfDay(
    instant,
    locale = undefined,
    timeZone = undefined,
    { seconds = false } = {}
) {
    const date = instant instanceof Date ? instant : new Date(instant ?? NaN);
    if (Number.isNaN(date.getTime())) {
        return "";
    }

    return date.toLocaleTimeString(locale, {
        hour: "2-digit",
        minute: "2-digit",
        ...(seconds && { second: "2-digit" }),
        ...(timeZone && { timeZone }),
    });
}
