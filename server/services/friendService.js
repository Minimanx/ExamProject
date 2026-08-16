/**
 * Friendships.
 *
 * A friendship is symmetric: "A is friends with B" and "B is friends with A" are
 * the same fact. It is therefore one row describing the pair, not two rows
 * describing directions.
 *
 * The pair is stored in a canonical order — the lexicographically smaller id
 * first — so a unique index on the two can see that (A,B) and (B,A) are the same
 * relationship. Without the ordering, the database cannot tell them apart and
 * the rule falls back to application code, where two people adding each other at
 * the same moment both pass the check. That is the shape of defect C4, and the
 * ordering is what stops it recurring here.
 *
 * `requesterID` is kept separately, because who asked still matters: only the
 * person who did not ask may accept.
 */

import { ObjectId } from "mongodb";
import db from "../database/createConnection.js";

export class NotFoundError extends Error {}
export class AlreadyExistsError extends Error {}

/** The two ids in the order the index expects them. */
export function pairOf(a, b) {
    return a < b ? { pairLow: a, pairHigh: b } : { pairLow: b, pairHigh: a };
}

/**
 * The collation the username index is built with.
 *
 * Uniqueness is enforced case-insensitively, so "Taken" and "taken" cannot both
 * exist — the system already treats them as one name. A lookup without this
 * matches case-sensitively, which means answering "no such user" about someone
 * who plainly exists, and scanning the whole collection to do it.
 */
export const USERNAME_COLLATION = { locale: "en", strength: 1 };

export async function request(requesterID, addresseeID) {
    if (requesterID === addresseeID) {
        throw new AlreadyExistsError("You cannot add yourself");
    }

    try {
        await db.friendships.insertOne({
            ...pairOf(requesterID, addresseeID),
            requesterID,
            state: "pending",
            createdAt: new Date(),
        });
    } catch (error) {
        // 11000 is the unique index doing its job: a friendship or a pending
        // request already exists between these two, in whichever direction.
        if (error.code === 11000) {
            throw new AlreadyExistsError("You are already connected to that person");
        }
        throw error;
    }
}

export async function find(id) {
    if (!ObjectId.isValid(id)) {
        return null;
    }
    return db.friendships.findOne({ _id: new ObjectId(id) });
}

/** Whether this user is part of a friendship at all. */
export function involves(friendship, userID) {
    return friendship.pairLow === userID || friendship.pairHigh === userID;
}

/** The person who did not ask — the only one who may accept. */
export function addresseeOf(friendship) {
    return friendship.requesterID === friendship.pairLow ? friendship.pairHigh : friendship.pairLow;
}

export async function accept(friendship) {
    await db.friendships.updateOne(
        { _id: friendship._id },
        { $set: { state: "accepted", respondedAt: new Date() } }
    );
}

export async function remove(friendship) {
    await db.friendships.deleteOne({ _id: friendship._id });
}

/**
 * Everyone connected to this user, split by what kind of connection it is.
 *
 * One query rather than three: the rows are the same rows, and which bucket each
 * belongs to is a property of the row rather than of the query.
 */
/**
 * Whether these two are actually friends.
 *
 * One question about one pair, for the camera gate, which asks it about each
 * peer as a call forms. `listFor` answers a different question — the whole
 * friend list with usernames attached — and would read every friendship either
 * person has to answer this one.
 *
 * Only "accepted" counts. Having asked someone to be your friend is not a
 * relationship they have agreed to, and it must not open your camera to them.
 */
export async function areFriends(a, b) {
    if (!a || !b || a === b) {
        return false;
    }

    const { pairLow, pairHigh } = pairOf(a, b);
    const row = await db.friendships.findOne({ pairLow, pairHigh, state: "accepted" });
    return row !== null;
}

export async function listFor(userID) {
    const rows = await db.friendships
        .find({ $or: [{ pairLow: userID }, { pairHigh: userID }] })
        .toArray();

    const otherIds = rows.map((row) => (row.pairLow === userID ? row.pairHigh : row.pairLow));
    const users = await db.users
        .find(
            { _id: { $in: otherIds.map((id) => new ObjectId(id)) } },
            // Deliberately narrow. A friend list is the natural place to leak an
            // email address to everyone who ever asked to be your friend.
            { projection: { username: 1 } }
        )
        .toArray();
    const usernameOf = new Map(users.map((user) => [user._id.toString(), user.username]));

    const buckets = { friends: [], incoming: [], outgoing: [] };
    for (const row of rows) {
        const otherID = row.pairLow === userID ? row.pairHigh : row.pairLow;
        const entry = {
            id: row._id.toString(),
            userID: otherID,
            username: usernameOf.get(otherID) ?? null,
        };

        if (row.state === "accepted") {
            buckets.friends.push(entry);
        } else if (row.requesterID === userID) {
            buckets.outgoing.push(entry);
        } else {
            buckets.incoming.push(entry);
        }
    }
    return buckets;
}
