import { inject, beforeEach, afterAll, vi } from "vitest";

process.env.MONGODB_URI = inject("mongoUri");
process.env.SESSION_SECRET = "test-session-secret-at-least-32-chars";
process.env.OMDB_API_KEY = "test-omdb-key";
process.env.CLIENT_ORIGINS = "http://localhost:8080";
process.env.NODE_ENV = "test";

// No network in tests: nodemailer opens a real SMTP socket to smtp.gmail.com,
// and a populated server/.env would send live email from the production account.
vi.mock("../mailer/mailer.js", () => ({ default: vi.fn(async () => true) }));

// Imported dynamically so the env vars above are set first.
const {
    default: db,
    mongoClientPromise,
    indexesReady,
} = await import("../database/createConnection.js");
// Index creation is async; tests that assert on indexes must not race it.
await indexesReady;

beforeEach(async () => {
    await db.users.deleteMany({});
    await db.theaters.deleteMany({});
});

afterAll(async () => {
    const client = await mongoClientPromise;
    await client.close();
});
