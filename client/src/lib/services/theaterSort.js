/**
 * Ordering the strip listing.
 *
 * Four columns, each with an ascending and a descending branch, were eight
 * near-identical blocks that sorted the array in place — and that array is a
 * prop, so the listing reordered the caller's copy of the world as a side effect
 * of a click on a column header. It survived only because the strip is drawn
 * from each theater's own slot number rather than from the order of the list.
 *
 * Directions were inconsistent too: three columns sorted ascending on the first
 * click and Time sorted descending, all showing the same colour for it. First
 * click is ascending everywhere now.
 */

/**
 * How many seats are still free.
 *
 * The column shows "2/10" and is headed with a people icon, so the useful
 * ordering is "where can I actually sit", not which host booked the biggest
 * room — by capacity, a full twenty-seat showing sorted above an empty ten.
 */
function freeSeats(theater) {
    return (theater.amountOfSpaces ?? 0) - (theater.usersInsideTheater?.length ?? 0);
}

/**
 * What each column sorts on. A key rather than a comparator per direction:
 * reversing is the caller's business, and doing it here is what produced eight
 * blocks where there are four columns.
 */
const KEYS = {
    // localeCompare, so "Ålborg Nights" sorts where a reader expects rather
    // than after "Zulu", which is where its code point puts it.
    name: (a, b) => String(a.eventName ?? "").localeCompare(String(b.eventName ?? "")),
    runtime: (a, b) => (a.movieRuntime ?? 0) - (b.movieRuntime ?? 0),
    startTime: (a, b) => new Date(a.startTime ?? 0).getTime() - new Date(b.startTime ?? 0).getTime(),
    spaces: (a, b) => freeSeats(a) - freeSeats(b),
};

export const SORT_KEYS = Object.keys(KEYS);

/**
 * A sorted copy. Never the array it was given: see above for what sorting a
 * prop in place cost.
 */
export function sortedBy(theaters, key, direction = "asc") {
    const compare = KEYS[key];
    if (compare === undefined) {
        return theaters;
    }

    const sign = direction === "desc" ? -1 : 1;
    return [...theaters].sort((a, b) => sign * compare(a, b));
}
