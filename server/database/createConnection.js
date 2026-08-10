import { MongoClient, ServerApiVersion } from "mongodb";
import "dotenv/config";
import { logger } from "../logger.js";

export const mongoUrl = process.env.MONGODB_URI;

if (!mongoUrl) {
    throw new Error("MONGODB_URI is required");
}

const client = new MongoClient(mongoUrl, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    },
});

export const mongoClientPromise = client.connect();
const connectedClient = await mongoClientPromise;
const db = connectedClient.db("FlixDrive");

const collections = {
    theaters: db.collection("theaters"),
    users: db.collection("users"),
    // Roadmap §3, hedge 2. The chosen sequencing is "features first, safety
    // retrofitted", and the risk it carries is that retrofitting moderation
    // into a live social product is how products get overrun. Retrofitting a UI
    // is easy; retrofitting a data model across a database that already holds
    // real user history is not. Nothing reads these until Phase 9.
    //
    // reports: { reporterID, subjectID, context: { kind, id }, reason, detail,
    //            state: "open" | "actioned" | "dismissed", createdAt }
    // blocks:  { blockerID, blockedID, createdAt }
    reports: db.collection("reports"),
    blocks: db.collection("blocks"),
    // Roadmap §3, hedge 1: registration can be closed behind INVITE_ONLY until
    // Phase 9's trust and safety work lands. "Features first" does not have to
    // mean "strangers first".
    //
    // invites: { code, createdAt, usedAt, usedBy }
    invites: db.collection("invites"),
};

/**
 * Give every account that predates `moderationState` the default value.
 *
 * Signup writes the field now, so only accounts created before it existed lack
 * it. Backfilling once at boot means Phase 9 never has to treat "absent" and
 * "active" as the same thing, which is the kind of special case that survives
 * for years. Idempotent: after the first run it matches nothing.
 */
export async function backfillModerationState() {
    await collections.users.updateMany(
        { moderationState: { $exists: false } },
        { $set: { moderationState: "active" } }
    );
}

/**
 * Create an index, replacing one that exists on the same keys with different
 * options.
 *
 * Mongo answers a createIndex whose options differ from the live index with
 * IndexOptionsConflict (85) rather than changing it, so tightening an index —
 * as `theaters.ownerID` and `theaters.position` were tightened to unique for
 * defect C4 — is a no-op on any database that already ran the old version.
 */
async function ensureIndex(collection, keys, options = {}) {
    try {
        return await collection.createIndex(keys, options);
    } catch (error) {
        if (error.code !== 85) {
            throw error;
        }
        await collection.dropIndex(await collection.createIndex(keys));
        return collection.createIndex(keys, options);
    }
}

// Every login and signup looked users up by email or username, and both were
// full collection scans. The unique constraints also move duplicate and
// concurrency checks out of application code — where two overlapping requests
// can both pass them — and into the database, which is the only place that can
// decide atomically. See defects O1 and C4.
export const indexesReady = Promise.all([
    ensureIndex(collections.users, { email: 1 }, { unique: true }),
    ensureIndex(
        collections.users,
        { username: 1 },
        { unique: true, collation: { locale: "en", strength: 1 } }
    ),
    ensureIndex(collections.theaters, { position: 1 }, { unique: true }),
    ensureIndex(collections.theaters, { ownerID: 1 }, { unique: true }),
    ensureIndex(collections.theaters, { timeToClose: 1 }),
    // Unused until Phase 9, but the shape of the queries is already known: a
    // moderator opens the queue oldest-first, and looks up everything ever
    // reported about one person.
    ensureIndex(collections.reports, { subjectID: 1, createdAt: -1 }),
    ensureIndex(collections.reports, { state: 1, createdAt: 1 }),
    // One person blocking another twice is the same block, so the database
    // says so rather than trusting a UI not to double-submit.
    ensureIndex(collections.blocks, { blockerID: 1, blockedID: 1 }, { unique: true }),
    // The reverse lookup — who has blocked me — is what filtering a room needs.
    ensureIndex(collections.blocks, { blockedID: 1 }),
    // Unique so two invites cannot share a code, and because claiming one is a
    // findOneAndUpdate on it.
    ensureIndex(collections.invites, { code: 1 }, { unique: true }),
])
    .then(backfillModerationState)
    .catch((error) => {
        // Logged rather than thrown so a boot is not blocked, but a unique index
        // that failed to build means its guarantee is silently absent — most likely
        // because the data already violates it. See DEPLOYMENT.md.
        logger.error({ err: error }, "Failed to create indexes");
    });

export default collections;
