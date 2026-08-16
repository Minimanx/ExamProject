/**
 * Which slot on the strip a link is asking to be taken to.
 *
 * There are two kinds of link and they behaved differently. "Invite to this
 * event", which anyone can follow, carries `?position=` and drives you there.
 * The private invite carries `?theater=<id>&key=<one-time key>` and did not:
 * the key was recognised once you reached the sign, but reaching it was left to
 * the recipient, who had to drive the strip reading marquees. The link that
 * matters more was the one that did less.
 *
 * The slot for an event is a fact about the listing rather than about the link,
 * which is why this is given the listing to look in.
 *
 * It also has to survive a hand-edited URL. `Number("abc")` is NaN, and NaN
 * propagated through the teleport into the player's own position — where every
 * subsequent step is NaN plus a distance, so the car never comes back without a
 * reload. A negative slot put it a screen and a half off the left edge.
 */
export function invitedSlot(searchParams, theaters, slotCount) {
    const theaterId = searchParams.get("theater");
    if (theaterId !== null) {
        // An event that has closed since the link was sent is simply not there.
        const invited = theaters.find((theater) => theater._id === theaterId);
        return invited === undefined ? null : invited.position;
    }

    // Matched as text rather than converted: Number("") is 0, so an empty
    // `?position=` would silently mean the first slot, and Number("abc") is NaN.
    // A slot is a run of digits or it is not a slot.
    const raw = searchParams.get("position");
    if (raw === null || !/^\d+$/.test(raw)) {
        return null;
    }

    const asked = Number(raw);

    // Past the end of the world, go as far as the world goes: the link is stale
    // rather than malicious, and the last slot is the closest thing to it.
    return asked >= slotCount ? slotCount - 1 : asked;
}
