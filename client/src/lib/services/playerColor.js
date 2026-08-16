/**
 * A colour for a car nobody has picked one for yet.
 *
 * It was built as `"#" + Math.floor(Math.random() * 16777215).toString(16)`,
 * which drops leading zeroes: any value below 0x100000 comes out with fewer than
 * six digits, so about one new account in sixteen was given something like
 * `#ff8a` — not a colour at all. Measured at 6.4% over 100,000 draws.
 *
 * Nothing failed loudly. An invalid colour in an svg stroke or a style attribute
 * is simply ignored, so those cars were drawn in the inherited colour and their
 * owners had no way to know why theirs looked wrong. Now that the server
 * replaces anything that is not a colour, they would all have come out grey.
 *
 * The multiplier is 0x1000000 rather than 0xFFFFFF so that white is reachable;
 * the old bound excluded it.
 */
export function randomPlayerColor(random = Math.random) {
    const value = Math.floor(random() * 0x1000000);
    return "#" + value.toString(16).padStart(6, "0");
}
