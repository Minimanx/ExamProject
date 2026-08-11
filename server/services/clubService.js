/**
 * Film clubs: a membership with roles, and a recurring meeting.
 *
 * Membership is a row per person per club, like a friendship is a row per pair,
 * and for the same reason: the unique index is what stops two simultaneous joins
 * creating two memberships.
 *
 * Roles are ordered — owner outranks moderator outranks member — because every
 * permission question here is "is this person at least an X".
 */

import { ObjectId } from "mongodb";
import db from "../database/createConnection.js";
import { nextOccurrence, describeSchedule } from "../world/schedule.js";

export class ConflictError extends Error {}

const RANK = { member: 0, moderator: 1, owner: 2 };

export function outranksOrEquals(role, required) {
    return (RANK[role] ?? -1) >= RANK[required];
}

/**
 * A name turned into something that can live in a URL.
 *
 * Derived rather than accepted from the client: it appears in a path, so it
 * cannot be whatever someone types. Accents are folded rather than dropped, or
 * "Café Nuit" and "Caf Nuit" would be the same club to a reader and different to
 * the database.
 */
export function slugify(name) {
    const slug = name
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

    // A name of only punctuation leaves nothing behind, and an empty slug in a
    // URL would collide with the club list itself.
    return slug.length > 0 ? slug : "club";
}

export async function create({ name, description, isPublic, schedule, ownerID }) {
    const base = slugify(name);

    // A club's slug has to be unique because it is its address. Retried rather
    // than checked first, because two clubs created at the same moment would
    // both pass a check and only one can have the slug.
    for (let attempt = 0; attempt < 5; attempt++) {
        const slug = attempt === 0 ? base : `${base}-${Math.random().toString(36).slice(2, 7)}`;

        try {
            const result = await db.clubs.insertOne({
                name,
                slug,
                description,
                isPublic,
                schedule,
                ownerID,
                createdAt: new Date(),
            });
            await db.clubMembers.insertOne({
                clubID: result.insertedId.toString(),
                userID: ownerID,
                role: "owner",
                joinedAt: new Date(),
            });
            return { id: result.insertedId.toString(), slug };
        } catch (error) {
            if (error.code !== 11000) {
                throw error;
            }
        }
    }

    throw new ConflictError("Could not find a free name for that club");
}

export async function findById(id) {
    if (!ObjectId.isValid(id)) {
        return null;
    }
    return db.clubs.findOne({ _id: new ObjectId(id) });
}

export async function findBySlug(slug) {
    return db.clubs.findOne({ slug });
}

export async function membershipOf(clubID, userID) {
    return db.clubMembers.findOne({ clubID, userID });
}

export async function join(clubID, userID) {
    try {
        await db.clubMembers.insertOne({
            clubID,
            userID,
            role: "member",
            joinedAt: new Date(),
        });
    } catch (error) {
        if (error.code === 11000) {
            throw new ConflictError("You are already a member");
        }
        throw error;
    }
}

export async function ownerCount(clubID) {
    return db.clubMembers.countDocuments({ clubID, role: "owner" });
}

export async function leave(clubID, userID) {
    await db.clubMembers.deleteOne({ clubID, userID });
}

export async function setRole(clubID, userID, role) {
    await db.clubMembers.updateOne({ clubID, userID }, { $set: { role } });
}

export async function remove(club) {
    const clubID = club._id.toString();
    await db.clubs.deleteOne({ _id: club._id });
    // Memberships go with it: a membership of a club that no longer exists is a
    // row nothing can ever read or clean up.
    await db.clubMembers.deleteMany({ clubID });
}

/** A club as a reader sees it, with its roster and when it next meets. */
export async function present(club) {
    const clubID = club._id.toString();
    const memberships = await db.clubMembers.find({ clubID }).toArray();

    const users = await db.users
        .find(
            { _id: { $in: memberships.map((row) => new ObjectId(row.userID)) } },
            // Narrow deliberately: a public club page is the widest audience any
            // of this data has, and an email address has no business on it.
            { projection: { username: 1 } }
        )
        .toArray();
    const usernameOf = new Map(users.map((user) => [user._id.toString(), user.username]));

    return {
        id: clubID,
        name: club.name,
        slug: club.slug,
        description: club.description,
        isPublic: club.isPublic,
        scheduleText: describeSchedule(club.schedule ?? null),
        nextMeeting: club.schedule ? nextOccurrence(club.schedule).toISOString() : null,
        members: memberships.map((row) => ({
            userID: row.userID,
            username: usernameOf.get(row.userID) ?? null,
            role: row.role,
        })),
    };
}

export async function listPublic() {
    const clubs = await db.clubs.find({ isPublic: true }).sort({ createdAt: 1 }).toArray();
    return Promise.all(clubs.map((club) => present(club)));
}
