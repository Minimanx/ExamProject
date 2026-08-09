import { inject, beforeEach, afterAll } from "vitest";

process.env.MONGODB_URI = inject("mongoUri");
process.env.SESSION_SECRET = "test-session-secret-at-least-32-chars";
process.env.OMDB_API_KEY = "test-omdb-key";
process.env.CLIENT_ORIGINS = "http://localhost:8080";
process.env.NODE_ENV = "test";

// Imported dynamically so the env vars above are set first.
const { default: db, mongoClientPromise } = await import("../database/createConnection.js");

beforeEach(async () => {
    await db.users.deleteMany({});
    await db.theaters.deleteMany({});
});

afterAll(async () => {
    const client = await mongoClientPromise;
    await client.close();
});
