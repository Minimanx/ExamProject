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
