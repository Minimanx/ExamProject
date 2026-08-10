import { MongoClient, ServerApiVersion } from "mongodb";
import "dotenv/config";

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
};

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
]).catch((error) => {
    // Logged rather than thrown so a boot is not blocked, but a unique index
    // that failed to build means its guarantee is silently absent — most likely
    // because the data already violates it. See DEPLOYMENT.md.
    console.error("Failed to create indexes", { message: error.message });
});

export default collections;
