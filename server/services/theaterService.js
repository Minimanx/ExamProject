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

import db from "../database/createConnection.js";
import { ObjectId } from "mongodb";
import { liveOccupants } from "../socketios/presence.js";

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

    const joinedSince = Date.now() - OCCUPANT_GRACE_MS;
    const present = stored.filter(
        (occupant) =>
            live.has(occupant?.userID) || new Date(occupant?.joinedAt ?? 0).getTime() > joinedSince
    );

    if (present.length !== stored.length) {
        await db.theaters.updateOne(
            { _id: theater._id },
            { $set: { usersInsideTheater: present } }
        );
    }
    return present;
}

/** The public strip: expired theaters swept, occupancy reconciled. */
export async function listTheaters(log) {
    await removeExpiredTheaters(log);

    // ownerID is not needed by any client view and should not be exposed, but
    // the listing itself stays public so events can be browsed before signing
    // up. See defect S8.
    const theaters = await db.theaters
        .find({}, { projection: { password: 0, ownerID: 0 } })
        .toArray();

    for (const theater of theaters) {
        theater.usersInsideTheater = await occupantsOf(theater);
    }
    return theaters;
}

export async function findTheater(id) {
    return db.theaters.findOne({ _id: new ObjectId(id) });
}

export async function findTheaterForViewer(id) {
    return db.theaters.findOne({ _id: new ObjectId(id) }, { projection: { password: 0 } });
}

export async function ownerHasLiveTheater(ownerID) {
    return (await db.theaters.countDocuments({ ownerID }, { limit: 1 })) > 0;
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
export async function createTheater(document) {
    for (let attempt = 0; attempt < MAX_SLOT_ATTEMPTS; attempt++) {
        const occupied = await db.theaters.find({}, { projection: { position: 1 } }).toArray();

        try {
            return await db.theaters.insertOne({
                ...document,
                usersInsideTheater: [],
                position: firstFreeSlot(occupied),
            });
        } catch (error) {
            if (error.code !== DUPLICATE_KEY) {
                throw error;
            }
            if (error.keyPattern?.ownerID) {
                throw new OwnerConflictError();
            }
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
