/**
 * Everything that reads or writes a theater.
 *
 * The router below this owns HTTP — status codes, sessions, request shapes —
 * and the socket layer owns connections. Neither touches the collection.
 *
 * The rule that matters most here is that occupancy has exactly one owner.
 * `usersInsideTheater` used to be written by the HTTP join and cleared by the
 * socket's disconnect handler, with nothing responsible for the pair, and that
 * split is what defect C5 cost: anything that broke the pairing — a tab closed
 * before the socket opened, a dropped connection, a restart clearing every
 * socket at once — left a ghost holding a seat for the life of the theater.
 */

import crypto from "crypto";
import db from "../database/createConnection.js";
import { ObjectId } from "mongodb";
import { liveOccupants, occupantsByTheater } from "../socketios/presence.js";

// A slot conflict means another request won the gap between reading the list
// and inserting. Retrying recomputes against the new state; the cap is there so
// a genuinely full strip fails rather than spins.
const MAX_SLOT_ATTEMPTS = 10;
const DUPLICATE_KEY = 11000;

/**
 * How long a freshly joined occupant is trusted without a live socket.
 *
 * The join and the socket handshake are two round trips, so someone who has
 * only just joined has no socket yet and must not be swept.
 */
const OCCUPANT_GRACE_MS = 60 * 1000;

/** Shared because a theater nobody is in is the common case, and it is read-only. */
const NOBODY = new Set();

export class OwnerConflictError extends Error {}
export class NoFreeSlotError extends Error {}

/**
 * The lowest slot number no live theater occupies.
 *
 * The old walk reassigned the candidate on every mismatch without breaking and
 * then fell back on `if (!theater.position)`, which cannot tell slot 0 from an
 * unset slot. See defect C3.
 */
function firstFreeSlot(theaters) {
    const taken = new Set(theaters.map((theater) => theater.position));
    let slot = 0;
    while (taken.has(slot)) {
        slot++;
    }
    return slot;
}

/**
 * Delete theaters whose closing time has passed.
 *
 * `timeToClose` was written when a theater was created and never read again, so
 * closed events accumulated forever — holding their slot on the strip and, via
 * the one-event-per-owner rule, permanently blocking their owner from creating
 * another. See defect C6.
 *
 * A lazy sweep rather than a scheduled job: the listing is hit on every page
 * load, which is trigger enough at this size and avoids standing up a
 * scheduler. The field is indexed.
 */
export async function removeExpiredTheaters(log) {
    try {
        await db.theaters.deleteMany({ timeToClose: { $lt: new Date() } });
    } catch (error) {
        // A failed sweep must not fail the request it was riding on.
        log.error({ err: error }, "Failed to remove expired theaters");
    }
}

/**
 * Drop occupants who are no longer there, and return who is.
 *
 * The socket rooms are the ground truth — a connection either exists or it does
 * not, and a restart clears them all — so the stored list is reconciled against
 * them rather than trusted. Entries in the old bare-string format have no join
 * time and sweep on first contact, which is the intent: they predate any socket
 * this process knows about. See defect C5.
 */
export async function occupantsOf(theater) {
    const stored = theater.usersInsideTheater ?? [];
    const live = await liveOccupants(theater._id.toString());
    if (live === null) {
        return stored;
    }

    const present = stillPresent(stored, live);
    if (present.length !== stored.length) {
        await db.theaters.updateOne(
            { _id: theater._id },
            { $set: { usersInsideTheater: present } }
        );
    }
    return present;
}

/**
 * Which stored occupants to keep, given who is connected.
 *
 * The decision itself, with no idea where the answer about connections came
 * from — one theater's room or a sweep of every socket. Both callers below need
 * it to be the same decision.
 */
function stillPresent(stored, live) {
    const joinedSince = Date.now() - OCCUPANT_GRACE_MS;
    return stored.filter(
        (occupant) =>
            live.has(occupant?.userID) || new Date(occupant?.joinedAt ?? 0).getTime() > joinedSince
    );
}

/**
 * Reconcile a whole listing against one snapshot of who is connected.
 *
 * `occupantsOf` answers for one theater and costs one adapter round-trip plus
 * one write. The listing called it in a loop, so the hottest endpoint in the app
 * paid both per theater, in sequence — for a question that a single pass over a
 * few dozen sockets answers for all of them at once. The sweeps that follow are
 * one write rather than one per theater, for the same reason.
 */
async function reconcileOccupancy(theaters) {
    const byTheater = occupantsByTheater();

    if (byTheater === null) {
        // Nothing to reconcile against. Normalising still matters: an old
        // document has no occupant list, and hasSpace counts one.
        for (const theater of theaters) {
            theater.usersInsideTheater ??= [];
        }
        return;
    }

    const sweeps = [];
    for (const theater of theaters) {
        const stored = theater.usersInsideTheater ?? [];
        const live = byTheater.get(theater._id.toString()) ?? NOBODY;
        const present = stillPresent(stored, live);

        theater.usersInsideTheater = present;
        if (present.length !== stored.length) {
            sweeps.push({
                updateOne: {
                    filter: { _id: theater._id },
                    update: { $set: { usersInsideTheater: present } },
                },
            });
        }
    }

    if (sweeps.length > 0) {
        await db.theaters.bulkWrite(sweeps);
    }
}

/**
 * Escape a user's search term so it is matched as text.
 *
 * The term comes from a search box, so it contains whatever was typed. Dropped
 * into a regular expression unescaped, `(` is a syntax error that fails the
 * request and `.*` is a pattern that matches every theater on the strip — a
 * search that silently returns everything is worse than one that errors.
 */
function asLiteral(term) {
    return term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * The public strip, optionally searched and filtered.
 *
 * Filtering happens in the query rather than the client. The client could do it
 * today only because the strip is small, which is a fact about the current size
 * rather than a design.
 */
export async function listTheaters(log, { q, hasSpace, startingWithin } = {}) {
    await removeExpiredTheaters(log);

    const filter = {};

    if (q) {
        const term = new RegExp(asLiteral(q), "i");
        // People search for the film as often as for whatever the host called
        // the evening, so both count as a match.
        filter.$or = [{ eventName: term }, { movieName: term }];
    }

    if (startingWithin) {
        // An event already under way is not "starting within" anything, but it
        // is the one you are most likely to want to walk into, so the window
        // bounds the future end only.
        filter.startTime = { $lte: new Date(Date.now() + Number(startingWithin) * 60000) };
    }

    // ownerID is not needed by any client view and should not be exposed, but
    // the listing itself stays public so events can be browsed before signing
    // up. See defect S8.
    // lobbyKey is projected out, not merely undisplayed: the listing is public,
    // so anything in it is public. isPrivate stays, because the UI has to know
    // to ask for a key.
    const theaters = await db.theaters
        .find(filter, { projection: { password: 0, ownerID: 0, lobbyKey: 0 } })
        .toArray();

    await reconcileOccupancy(theaters);

    // Applied after reconciliation, not in the query: a theater whose seats are
    // held by ghosts is not full, and only the sweep knows that. See defect C5.
    if (hasSpace === "true") {
        return theaters.filter(
            (theater) => theater.usersInsideTheater.length < theater.amountOfSpaces
        );
    }
    return theaters;
}

export async function findTheater(id) {
    return db.theaters.findOne({ _id: new ObjectId(id) });
}

export async function findTheaterForViewer(id) {
    return db.theaters.findOne(
        { _id: new ObjectId(id) },
        { projection: { password: 0, lobbyKey: 0 } }
    );
}

/**
 * A key for a private lobby, shareable as a link.
 *
 * Replaces a bcrypt-hashed password the host had to invent and pass on out of
 * band. 16 hex characters is 64 bits: an event lasts hours and a wrong key is a
 * 403, so the search is hopeless well inside the theater's own lifetime.
 */
export function generateLobbyKey() {
    return crypto.randomBytes(8).toString("hex");
}

export async function ownerEventCount(ownerID) {
    return db.theaters.countDocuments({ ownerID });
}

/**
 * The lowest owner slot this person is not already using, or null when they are
 * at their limit.
 *
 * A unique index on `ownerID` says "at most one" and nothing else, which is why
 * making the limit configurable needed a second field. `{ ownerID, ownerSlot }`
 * unique says "at most one per slot", and slots are bounded by the limit, so the
 * database still decides — a count-then-insert would let every racing request
 * read the same count and all proceed. See defect C4 for what that costs.
 */
function firstFreeOwnerSlot(taken, maxEventsPerOwner) {
    const used = new Set(taken.map((theater) => theater.ownerSlot ?? 0));
    for (let slot = 0; slot < maxEventsPerOwner; slot++) {
        if (!used.has(slot)) {
            return slot;
        }
    }
    return null;
}

/**
 * Insert a theater into the lowest free slot.
 *
 * Both uniqueness rules — one live event per owner, one theater per slot — are
 * enforced by unique indexes, because two overlapping requests read the same
 * list and reach the same conclusion. An owner conflict is final; a slot
 * conflict only means someone else took the gap first, so recompute and retry.
 * See defect C4.
 */
export async function createTheater(document, { maxEventsPerOwner }) {
    for (let attempt = 0; attempt < MAX_SLOT_ATTEMPTS; attempt++) {
        const occupied = await db.theaters.find({}, { projection: { position: 1 } }).toArray();
        const mine = await db.theaters
            .find({ ownerID: document.ownerID }, { projection: { ownerSlot: 1 } })
            .toArray();

        const ownerSlot = firstFreeOwnerSlot(mine, maxEventsPerOwner);
        if (ownerSlot === null) {
            throw new OwnerConflictError();
        }

        try {
            return await db.theaters.insertOne({
                ...document,
                usersInsideTheater: [],
                position: firstFreeSlot(occupied),
                ownerSlot,
            });
        } catch (error) {
            if (error.code !== DUPLICATE_KEY) {
                throw error;
            }
            // Either slot can collide, and both mean the same thing: someone
            // took it between the read and the insert. Recompute and try again;
            // an owner genuinely at their limit exits above, not here.
        }
    }

    throw new NoFreeSlotError(`Gave up after ${MAX_SLOT_ATTEMPTS} attempts`);
}

/** Record that someone is inside. Idempotent: joining twice adds one entry. */
export async function addOccupant(theaterId, userID) {
    await db.theaters.updateOne(
        { _id: new ObjectId(theaterId), "usersInsideTheater.userID": { $ne: userID } },
        { $push: { usersInsideTheater: { userID, joinedAt: new Date() } } }
    );
}

/** Record that someone has left. Called by the socket layer, which owns the leave. */
export async function removeOccupant(theaterId, userID) {
    await db.theaters.updateOne(
        { _id: new ObjectId(theaterId) },
        // Occupants carry a join time, so the pull matches on the id field
        // rather than the whole entry.
        { $pull: { usersInsideTheater: { userID } } }
    );
}

export async function deleteTheater(id) {
    await db.theaters.deleteOne({ _id: new ObjectId(id) });
}
