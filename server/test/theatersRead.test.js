import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../app.js";
import { registerUser, loginAgent, seedTheater } from "./helpers.js";

describe("GET /theaters", () => {
    // Defect S8 (roadmap spec §5, fixed): the endpoint still requires no
    // session — browsing events before signing up is intended — but it no
    // longer exposes ownerID, which no client view needs.
    it("is readable without logging in", async () => {
        await seedTheater({ eventName: "Public Night" });

        const response = await request(app).get("/theaters");

        expect(response.status).toBe(200);
        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0].eventName).toBe("Public Night");
        expect(response.body.data[0].ownerID).toBeUndefined();
    });

    it("never returns the theater password hash", async () => {
        await seedTheater({ passwordBool: true, password: "$2b$12$fakehashfakehashfake" });

        const response = await request(app).get("/theaters");

        expect(response.body.data[0].password).toBeUndefined();
    });

    it("returns an empty array when there are no theaters", async () => {
        const response = await request(app).get("/theaters");

        expect(response.status).toBe(200);
        expect(response.body.data).toEqual([]);
    });
});

describe("GET /theaters/:id", () => {
    it("requires a session", async () => {
        const theater = await seedTheater();

        const response = await request(app).get(`/theaters/${theater._id}`);

        expect(response.status).toBe(400);
        expect(response.body.message).toBe("Must be logged in");
    });

    it("rejects a malformed id", async () => {
        const user = await registerUser();
        const agent = await loginAgent(user);

        const response = await agent.get("/theaters/not-an-object-id");

        expect(response.status).toBe(400);
        expect(response.body.message).toBe("Invalid theater");
    });

    it("returns 404 for a well-formed id that does not exist", async () => {
        const user = await registerUser();
        const agent = await loginAgent(user);

        const response = await agent.get("/theaters/000000000000000000000099");

        expect(response.status).toBe(404);
        expect(response.body.message).toBe("Theater not found");
    });

    it("returns the theater without its password hash", async () => {
        const user = await registerUser();
        const agent = await loginAgent(user);
        const theater = await seedTheater({
            eventName: "Private Night",
            passwordBool: true,
            password: "$2b$12$fakehashfakehashfake",
        });

        const response = await agent.get(`/theaters/${theater._id}`);

        expect(response.status).toBe(200);
        expect(response.body.data.eventName).toBe("Private Night");
        expect(response.body.data.password).toBeUndefined();
    });
});
