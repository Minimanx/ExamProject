import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import request from "supertest";
import { app } from "../app.js";
import db from "../database/createConnection.js";
import { registerUser, loginAgent, seedTheater, mockOmdb } from "./helpers.js";

// Phase 3 replaces the theater password with a lobby key. The password was
// something the host had to invent and then tell people out of band, stored
// bcrypt-hashed so nobody — including the host — could read it back. A key is
// generated server-side and handed to the host to share as a link.
const omdbMovie = {
    Response: "True",
    Title: "The Matrix",
    Year: "1999",
    Runtime: "136 min",
    imdbRating: "8.7",
    Poster: "https://example.com/poster.jpg",
    Plot: "A hacker learns the truth.",
    Genre: "Action, Sci-Fi",
};

function validEvent(overrides = {}) {
    return {
        eventName: "Movie Night",
        startTime: new Date(Date.now() + 3600000).toISOString(),
        amountOfSpaces: 10,
        imdbID: "tt0133093",
        ...overrides,
    };
}

const fetchMock = vi.fn();

async function loggedInUser() {
    const user = await registerUser();
    const agent = await loginAgent(user);
    const stored = await db.users.findOne({ email: user.email.toLowerCase() });
    return { agent, userID: stored._id.toString() };
}

describe("creating a private theater", () => {
    beforeEach(() => {
        fetchMock.mockReset();
        vi.stubGlobal("fetch", fetchMock);
        mockOmdb(fetchMock, omdbMovie);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("generates a key the host never had to invent", async () => {
        const { agent } = await loggedInUser();

        const response = await agent
            .post("/theaters")
            .send({ data: validEvent({ private: true }) });

        expect(response.status).toBe(200);
        const stored = await db.theaters.findOne({ eventName: "Movie Night" });
        expect(stored.lobbyKey).toMatch(/^[0-9a-f]{16}$/);
    });

    // The host has to be able to share it, which is the whole point — unlike the
    // old bcrypt hash, which nobody could read back.
    it("returns the key to the host who created it", async () => {
        const { agent } = await loggedInUser();

        const response = await agent
            .post("/theaters")
            .send({ data: validEvent({ private: true }) });

        expect(response.body.lobbyKey).toMatch(/^[0-9a-f]{16}$/);
    });

    // The host needs both halves to build a link, and the key is never
    // retrievable afterwards, so the id has to come back in the same response.
    it("returns the theater id alongside the key", async () => {
        const { agent } = await loggedInUser();

        const response = await agent
            .post("/theaters")
            .send({ data: validEvent({ private: true }) });

        const stored = await db.theaters.findOne({ eventName: "Movie Night" });
        expect(response.body.theaterId).toBe(stored._id.toString());
    });

    it("gives a public theater no key at all", async () => {
        const { agent } = await loggedInUser();

        await agent.post("/theaters").send({ data: validEvent({ private: false }) });

        const stored = await db.theaters.findOne({ eventName: "Movie Night" });
        expect(stored.lobbyKey).toBeUndefined();
        expect(stored.isPrivate).toBe(false);
    });

    it("gives two private theaters different keys", async () => {
        const first = await loggedInUser();
        const second = await loggedInUser();

        await first.agent.post("/theaters").send({ data: validEvent({ private: true }) });
        await second.agent
            .post("/theaters")
            .send({ data: validEvent({ eventName: "Second Night", private: true }) });

        const stored = await db.theaters.find({}).toArray();
        expect(new Set(stored.map((theater) => theater.lobbyKey)).size).toBe(2);
    });
});

describe("the listing never exposes a key", () => {
    it("omits lobbyKey from the public listing", async () => {
        await seedTheater({ isPrivate: true, lobbyKey: "abcdef0123456789" });

        const response = await request(app).get("/theaters");

        expect(JSON.stringify(response.body)).not.toContain("abcdef0123456789");
    });

    it("still says a theater is private, so the UI can ask for a key", async () => {
        await seedTheater({ isPrivate: true, lobbyKey: "abcdef0123456789" });

        const response = await request(app).get("/theaters");

        expect(response.body.data[0].isPrivate).toBe(true);
    });
});

describe("joining with a lobby key", () => {
    it("lets the right key in", async () => {
        const { agent, userID } = await loggedInUser();
        const theater = await seedTheater({ isPrivate: true, lobbyKey: "abcdef0123456789" });

        const response = await agent
            .patch(`/theaters/${theater._id}`)
            .send({ joining: true, userID, lobbyKey: "abcdef0123456789" });

        expect(response.status).toBe(200);
    });

    it("keeps the wrong key out", async () => {
        const { agent, userID } = await loggedInUser();
        const theater = await seedTheater({ isPrivate: true, lobbyKey: "abcdef0123456789" });

        const response = await agent
            .patch(`/theaters/${theater._id}`)
            .send({ joining: true, userID, lobbyKey: "0000000000000000" });

        expect(response.status).toBe(403);
        expect(response.body.message).toBe("That link is not valid for this event");
    });

    it("keeps out a join with no key at all", async () => {
        const { agent, userID } = await loggedInUser();
        const theater = await seedTheater({ isPrivate: true, lobbyKey: "abcdef0123456789" });

        const response = await agent
            .patch(`/theaters/${theater._id}`)
            .send({ joining: true, userID });

        expect(response.status).toBe(403);
    });

    it("asks nothing of a public theater", async () => {
        const { agent, userID } = await loggedInUser();
        const theater = await seedTheater({ isPrivate: false });

        const response = await agent
            .patch(`/theaters/${theater._id}`)
            .send({ joining: true, userID });

        expect(response.status).toBe(200);
    });

    // Theaters created before this change carry passwordBool and a bcrypt hash,
    // and they expire on their own within hours. Until the last one is gone the
    // old path has to keep working, or someone's evening breaks mid-event.
    it("still accepts the old bcrypt password on a theater that predates keys", async () => {
        const bcrypt = (await import("bcrypt")).default;
        const { agent, userID } = await loggedInUser();
        const theater = await seedTheater({
            passwordBool: true,
            password: await bcrypt.hash("legacy-password", 4),
        });

        const response = await agent
            .patch(`/theaters/${theater._id}`)
            .send({ joining: true, userID, password: "legacy-password" });

        expect(response.status).toBe(200);
    });

    it("still rejects a wrong password on a theater that predates keys", async () => {
        const bcrypt = (await import("bcrypt")).default;
        const { agent, userID } = await loggedInUser();
        const theater = await seedTheater({
            passwordBool: true,
            password: await bcrypt.hash("legacy-password", 4),
        });

        const response = await agent
            .patch(`/theaters/${theater._id}`)
            .send({ joining: true, userID, password: "wrong" });

        expect(response.status).toBe(403);
    });
});
