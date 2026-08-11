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
/**
 * Remove an index that a later design replaced.
 *
 * A unique `ownerID_1` still enforces one-event-per-owner no matter what the
 * compound index says, so leaving it behind would silently pin the limit at 1 on
 * any database that ran the old version. Idempotent: a missing index is fine.
 */
const INDEX_NOT_FOUND = 27;
const NAMESPACE_NOT_FOUND = 26;

export async function dropSupersededIndex(collection, name) {
    try {
        await collection.dropIndex(name);
    } catch (error) {
        // Both mean "there is nothing here to drop", and both are the ordinary
        // case on a fresh database: the index is absent, or the collection it
        // would live in has not been created yet. Only IndexNotFound is
        // obvious. Missing NamespaceNotFound was not visible in a full test run,
        // because some earlier file always created the collection first — it
        // only appears on a genuinely empty database, which is to say on a first
        // deploy.
        if (error.code !== INDEX_NOT_FOUND && error.code !== NAMESPACE_NOT_FOUND) {
            throw error;
        }
    }
}

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
/**
 * Build every index, reporting each failure on its own.
 *
 * This was a `Promise.all` whose rejection was caught and logged, which fails
 * twice over: one bad entry cancels every other index, and the process then runs
 * as though nothing were wrong. That is not hypothetical — a `dropIndex` on a
 * collection that did not exist yet answered NamespaceNotFound rather than
 * IndexNotFound, and took every uniqueness guarantee in the database with it,
 * including the one holding "at most N events per owner" together.
 *
 * `allSettled` keeps a failure local, and each one is named, because a unique
 * index that did not build means its guarantee is silently absent — which is
 * precisely the class of problem the unique indexes exist to prevent. See
 * DEPLOYMENT.md.
 */
async function buildAll(steps) {
    const outcomes = await Promise.allSettled(Object.values(steps).map((step) => step()));

    Object.keys(steps).forEach((name, index) => {
        const outcome = outcomes[index];
        if (outcome.status === "rejected") {
            logger.error(
                { index: name, err: outcome.reason },
                "Failed to build an index — its guarantee is not in force"
            );
        }
    });
}

export const indexesReady = buildAll({
    // Every login and signup looked users up by email or username, and both were
    // full collection scans. The unique constraints also move duplicate and
    // concurrency checks out of application code — where two overlapping
    // requests can both pass them — and into the database, which is the only
    // place that can decide atomically. See defects O1 and C4.
    "users.email": () => ensureIndex(collections.users, { email: 1 }, { unique: true }),
    "users.username": () =>
        ensureIndex(
            collections.users,
            { username: 1 },
            { unique: true, collation: { locale: "en", strength: 1 } }
        ),
    "theaters.position": () => ensureIndex(collections.theaters, { position: 1 }, { unique: true }),
    // Dropped, not kept: a unique index on the owner alone says "at most one
    // event" no matter what the compound index says, so leaving it behind would
    // pin the configurable limit at 1.
    "theaters.ownerID (superseded)": () => dropSupersededIndex(collections.theaters, "ownerID_1"),
    // { ownerID, ownerSlot } because Phase 3 made the per-owner limit
    // configurable, and slots bounded by that limit keep "at most N" a decision
    // the database makes rather than a count-then-insert that races.
    "theaters.ownerSlot": () =>
        ensureIndex(collections.theaters, { ownerID: 1, ownerSlot: 1 }, { unique: true }),
    "theaters.timeToClose": () => ensureIndex(collections.theaters, { timeToClose: 1 }),
    // Unused until Phase 9, but the shape of the queries is already known: a
    // moderator opens the queue oldest-first, and looks up everything ever
    // reported about one person.
    "reports.subject": () => ensureIndex(collections.reports, { subjectID: 1, createdAt: -1 }),
    "reports.queue": () => ensureIndex(collections.reports, { state: 1, createdAt: 1 }),
    // One person blocking another twice is the same block, so the database says
    // so rather than trusting a UI not to double-submit.
    "blocks.pair": () =>
        ensureIndex(collections.blocks, { blockerID: 1, blockedID: 1 }, { unique: true }),
    // The reverse lookup — who has blocked me — is what filtering a room needs.
    "blocks.blocked": () => ensureIndex(collections.blocks, { blockedID: 1 }),
    // Unique so two invites cannot share a code, and because claiming one is a
    // findOneAndUpdate on it.
    "invites.code": () => ensureIndex(collections.invites, { code: 1 }, { unique: true }),
}).then(backfillModerationState);

export default collections;
