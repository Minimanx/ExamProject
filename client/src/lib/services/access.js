/**
 * Whether an event needs something to get into.
 *
 * Lobby keys replaced passwords in Phase 3.3, and the field the views read to
 * draw a padlock — `passwordBool` — went with them. Nothing writes it any more,
 * so both views quietly answered "no" for every event created since: the strip's
 * marquee announced a private showing as "Public Event", and the listing drew
 * the open padlock beside it. A host ticked the box, was handed an invite link,
 * and their event advertised itself as open to everyone.
 *
 * Both forms count, because the join route honours both. Theaters made before
 * lobby keys still open to a password, and the route says why that branch is
 * still there: they expire within hours of their showing, so it comes out once
 * none can still be live. Until then an event that asks for something has to
 * look like it.
 */
export function isLocked(theater) {
    return Boolean(theater?.isPrivate || theater?.passwordBool);
}
