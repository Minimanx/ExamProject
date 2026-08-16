/**
 * The query string the listing is asked for.
 *
 * Kept out of the component so it can be tested directly, and so the search term
 * — which is whatever somebody typed — is demonstrably encoded rather than
 * concatenated. An unencoded `&` in an event name would otherwise arrive as a
 * second parameter, and the server would search for the half before it.
 *
 * An unset filter is left out rather than sent empty: the listing schema takes
 * `hasSpace` as "true" or "false" and `startingWithin` as a positive number of
 * minutes, and rejects the request outright for an empty string.
 */
export function listingQuery({ term = "", onlyWithSpace = false, startingWithin = "" } = {}) {
    const params = new URLSearchParams();

    const searched = term.trim();
    if (searched) params.set("q", searched);
    if (onlyWithSpace) params.set("hasSpace", "true");
    if (startingWithin) params.set("startingWithin", startingWithin);

    return params.toString();
}

/** Whether any of it would actually narrow the strip. */
export function narrows({ term = "", onlyWithSpace = false, startingWithin = "" } = {}) {
    return term.trim() !== "" || onlyWithSpace || startingWithin !== "";
}
