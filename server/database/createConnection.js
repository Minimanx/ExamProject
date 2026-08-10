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

export default {
    theaters: db.collection("theaters"),
    users: db.collection("users"),
};
