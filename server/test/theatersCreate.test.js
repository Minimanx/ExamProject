import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import request from "supertest";
import { app } from "../app.js";
import db from "../database/createConnection.js";
import { registerUser, loginAgent, seedTheater, mockOmdb } from "./helpers.js";

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
        passwordBool: false,
        ...overrides,
    };
}

const fetchMock = vi.fn();

describe("POST /theaters", () => {
    beforeEach(() => {
        fetchMock.mockReset();
        vi.stubGlobal("fetch", fetchMock);
        mockOmdb(fetchMock, omdbMovie);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("requires a session", async () => {
        const response = await request(app).post("/theaters").send({ data: validEvent() });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe("Must be logged in to create a new event");
    });

    it("rejects an event with missing required fields", async () => {
        const agent = await loginAgent(await registerUser());

        const response = await agent.post("/theaters").send({ data: { eventName: "Only a name" } });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe("All fields must be filled");
    });

    it("rejects an event name outside 3-18 characters", async () => {
        const agent = await loginAgent(await registerUser());

        const response = await agent
            .post("/theaters")
            .send({ data: validEvent({ eventName: "ab" }) });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe("Event name must be between 3 and 18 characters");
    });

    it("rejects a seat count above 99", async () => {
        const agent = await loginAgent(await registerUser());

        const response = await agent
            .post("/theaters")
            .send({ data: validEvent({ amountOfSpaces: 100 }) });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe("Amount of spaces must be between 1 and 99");
    });

    it("rejects a start time more than 24 hours out", async () => {
        const agent = await loginAgent(await registerUser());
        const startTime = new Date(Date.now() + 26 * 3600000).toISOString();

        const response = await agent.post("/theaters").send({ data: validEvent({ startTime }) });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe("Time must be within 24 hours");
    });

    it("rejects a short password when passwordBool is set", async () => {
        const agent = await loginAgent(await registerUser());

        const response = await agent
            .post("/theaters")
            .send({ data: validEvent({ passwordBool: true, password: "short" }) });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe("Password must be between 8 and 24 characters");
    });

    it("creates the theater and enriches it from OMDB", async () => {
        const agent = await loginAgent(await registerUser());

        const response = await agent.post("/theaters").send({ data: validEvent() });

        expect(response.status).toBe(200);
        expect(response.body.message).toBe("Event Created");

        const stored = await db.theaters.findOne({ eventName: "Movie Night" });
        expect(stored.movieName).toBe("The Matrix");
        expect(stored.movieRuntime).toBe(136);
        expect(stored.movieReleaseYear).toBe("1999");
        expect(stored.usersInsideTheater).toEqual([]);
        expect(stored.position).toBe(0);
    });

    it("hashes the theater password when one is set", async () => {
        const agent = await loginAgent(await registerUser());

        await agent
            .post("/theaters")
            .send({ data: validEvent({ passwordBool: true, password: "lobbypassword" }) });

        const stored = await db.theaters.findOne({ eventName: "Movie Night" });
        expect(stored.password).not.toBe("lobbypassword");
        expect(stored.password.startsWith("$2")).toBe(true);
    });

    it("allows only one live event per owner", async () => {
        const user = await registerUser();
        const agent = await loginAgent(user);
        await agent.post("/theaters").send({ data: validEvent() });

        const response = await agent
            .post("/theaters")
            .send({ data: validEvent({ eventName: "Second Night" }) });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe("You already have an ongoing event");
    });

    it("returns 502 when OMDB is unreachable", async () => {
        const agent = await loginAgent(await registerUser());
        fetchMock.mockRejectedValue(new Error("ECONNREFUSED"));

        const response = await agent.post("/theaters").send({ data: validEvent() });

        expect(response.status).toBe(502);
        expect(response.body.message).toBe("Movie details are temporarily unavailable");
    });

    it("assigns the next free slot when one is already taken", async () => {
        await seedTheater({ position: 0, eventName: "Existing" });
        const agent = await loginAgent(await registerUser());

        const response = await agent.post("/theaters").send({ data: validEvent() });

        expect(response.status).toBe(200);
        const stored = await db.theaters.findOne({ eventName: "Movie Night" });
        expect(stored.position).toBe(1);
    });
});

// DEFECT C4 (roadmap spec §5): `req.session.creatingEvent` was used as a mutex
// against double-creation. A session is only written back to the store when the
// response ends, so two requests that overlap both read it as undefined and both
// proceed — the mutex never held even on one instance, let alone across several.
// The database is the only place that can decide this atomically.
describe("POST /theaters concurrency", () => {
    beforeEach(() => {
        fetchMock.mockReset();
        vi.stubGlobal("fetch", fetchMock);
        mockOmdb(fetchMock, omdbMovie);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("creates one event when the same user fires two requests at once", async () => {
        const agent = await loginAgent(await registerUser());

        const responses = await Promise.all([
            agent.post("/theaters").send({ data: validEvent({ eventName: "First" }) }),
            agent.post("/theaters").send({ data: validEvent({ eventName: "Second" }) }),
        ]);

        expect(responses.filter((response) => response.status === 200)).toHaveLength(1);
        expect(await db.theaters.countDocuments({})).toBe(1);

        // The loser must get the ordinary explanation, not a 500 leaking the
        // duplicate-key error the index raised.
        const loser = responses.find((response) => response.status !== 200);
        expect(loser.status).toBe(400);
        expect(loser.body.message).toBe("You already have an ongoing event");
    });

    // Two owners racing hit the same gap: both read the list, both compute the
    // same first free slot, and both insert. The strip then has two theaters
    // stacked on one position.
    it("gives two users racing for the same slot different slots", async () => {
        const first = await loginAgent(await registerUser());
        const second = await loginAgent(await registerUser());

        const responses = await Promise.all([
            first.post("/theaters").send({ data: validEvent({ eventName: "First" }) }),
            second.post("/theaters").send({ data: validEvent({ eventName: "Second" }) }),
        ]);

        expect(responses.map((response) => response.status)).toEqual([200, 200]);
        const stored = await db.theaters.find({}).toArray();
        expect(new Set(stored.map((theater) => theater.position)).size).toBe(2);
    });

    // The flag was set before validation and cleared on each early return. A
    // path that missed one — or a throw — left it stuck true, and the owner
    // could never create an event again for the life of the session.
    it("lets a user retry after a rejected attempt", async () => {
        const agent = await loginAgent(await registerUser());
        await agent.post("/theaters").send({ data: validEvent({ eventName: "no" }) });

        const response = await agent.post("/theaters").send({ data: validEvent() });

        expect(response.status).toBe(200);
    });

    it("lets a user retry after the movie lookup fails", async () => {
        const agent = await loginAgent(await registerUser());
        fetchMock.mockRejectedValueOnce(new Error("ECONNREFUSED"));
        await agent.post("/theaters").send({ data: validEvent() });

        const response = await agent.post("/theaters").send({ data: validEvent() });

        expect(response.status).toBe(200);
    });
});

// DEFECT C3 (roadmap spec §5): slot allocation walked the sorted list
// reassigning `theater.position` without breaking, then fell back on
// `if (!theater.position)` — which cannot tell slot 0 from an unset slot. The
// deeper problem was that `theater` *is* `req.body.data`, so a position the
// client sent survived whenever the loop happened not to overwrite it.
describe("POST /theaters slot allocation", () => {
    beforeEach(() => {
        fetchMock.mockReset();
        vi.stubGlobal("fetch", fetchMock);
        mockOmdb(fetchMock, omdbMovie);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    async function createAt(occupied) {
        for (const position of occupied) {
            await seedTheater({
                position,
                eventName: `Existing ${position}`,
                ownerID: `${position}`,
            });
        }
        const agent = await loginAgent(await registerUser());
        const response = await agent.post("/theaters").send({ data: validEvent() });
        expect(response.status).toBe(200);
        return db.theaters.findOne({ eventName: "Movie Night" });
    }

    it.each([
        [[], 0],
        [[0], 1],
        [[0, 1, 2], 3],
        [[1, 2], 0],
        [[0, 2], 1],
        [[0, 1, 3], 2],
        [[2, 0, 1], 3],
    ])("with slots %j taken, takes slot %i", async (occupied, expected) => {
        const stored = await createAt(occupied);

        expect(stored.position).toBe(expected);
    });

    // A client-sent 0 was masked by the `!theater.position` fallback, which
    // overwrote it for the wrong reason. Any other number survived.
    it.each([0, 5, 98])("ignores slot %i when the client picks it", async (chosen) => {
        await seedTheater({ position: 0, eventName: "Existing", ownerID: "999" });
        const agent = await loginAgent(await registerUser());

        await agent.post("/theaters").send({ data: validEvent({ position: chosen }) });

        const stored = await db.theaters.findOne({ eventName: "Movie Night" });
        expect(stored.position).toBe(1);
    });

    it.each([
        ["The Matrix", undefined],
        ["A Very Long Movie Title Indeed", "A Very Long Movie..."],
    ])("stores a shortened %s as %s", async (title, expected) => {
        const agent = await loginAgent(await registerUser());
        mockOmdb(fetchMock, { ...omdbMovie, Title: title });

        await agent.post("/theaters").send({ data: validEvent() });

        const stored = await db.theaters.findOne({ eventName: "Movie Night" });
        expect(stored.movieName).toBe(title);
        expect(stored.movieNameCutToFit).toBe(expected);
    });

    // `theater` was the request body, so anything the client sent that the
    // handler did not overwrite was stored verbatim.
    it("ignores fields the client invented", async () => {
        const agent = await loginAgent(await registerUser());

        await agent.post("/theaters").send({
            data: validEvent({ imdbRating: "10.0", isAdmin: true, timeToClose: "1999-01-01" }),
        });

        const stored = await db.theaters.findOne({ eventName: "Movie Night" });
        expect(stored.imdbRating).toBe("8.7");
        expect(stored.isAdmin).toBeUndefined();
        expect(new Date(stored.timeToClose).getFullYear()).toBeGreaterThan(2000);
    });
});
