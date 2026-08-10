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

// Every login and signup looked users up by email or username, and both were
// full collection scans. The unique constraints also move the duplicate check
// from application code — where two concurrent signups can both pass it — into
// the database. See defect O1.
export const indexesReady = Promise.all([
    collections.users.createIndex({ email: 1 }, { unique: true }),
    collections.users.createIndex(
        { username: 1 },
        { unique: true, collation: { locale: "en", strength: 1 } }
    ),
    collections.theaters.createIndex({ position: 1 }),
    collections.theaters.createIndex({ ownerID: 1 }),
    collections.theaters.createIndex({ timeToClose: 1 }),
]).catch((error) => {
    console.error("Failed to create indexes", { message: error.message });
});

export default collections;
