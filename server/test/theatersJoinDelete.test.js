import { describe, it, expect } from "vitest";
import request from "supertest";
import bcrypt from "bcrypt";
import { app } from "../app.js";
import db from "../database/createConnection.js";
import { registerUser, loginAgent, seedTheater } from "./helpers.js";

async function loggedInUser() {
    const user = await registerUser();
    const agent = await loginAgent(user);
    const stored = await db.users.findOne({ email: user.email.toLowerCase() });
    return { agent, userID: stored._id.toString() };
}

describe("PATCH /theaters/:id", () => {
    it("rejects a malformed id", async () => {
        const { agent, userID } = await loggedInUser();

        const response = await agent
            .patch("/theaters/not-an-object-id")
            .send({ joining: true, userID });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe("Invalid theater");
    });

    it("rejects joining without a session", async () => {
        const theater = await seedTheater();

        const response = await request(app)
            .patch(`/theaters/${theater._id}`)
            .send({ joining: true, userID: "000000000000000000000001" });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe("Must be logged in to join theater");
    });

    it("rejects a body userID that does not match the session", async () => {
        const { agent } = await loggedInUser();
        const theater = await seedTheater();

        const response = await agent
            .patch(`/theaters/${theater._id}`)
            .send({ joining: true, userID: "000000000000000000000002" });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe("Must be logged in to join theater");
    });

    it("joins an open theater and records the occupant", async () => {
        const { agent, userID } = await loggedInUser();
        const theater = await seedTheater();

        const response = await agent
            .patch(`/theaters/${theater._id}`)
            .send({ joining: true, userID });

        expect(response.status).toBe(200);
        expect(response.body.message).toBe("Successfully joined lobby");

        const stored = await db.theaters.findOne({ _id: theater._id });
        expect(stored.usersInsideTheater).toEqual([userID]);
    });

    it("rejects a wrong lobby password", async () => {
        const { agent, userID } = await loggedInUser();
        const theater = await seedTheater({
            passwordBool: true,
            password: await bcrypt.hash("correct-password", 4),
        });

        const response = await agent
            .patch(`/theaters/${theater._id}`)
            .send({ joining: true, userID, password: "wrong-password" });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe("Password doesn't match");
    });

    it("accepts the correct lobby password", async () => {
        const { agent, userID } = await loggedInUser();
        const theater = await seedTheater({
            passwordBool: true,
            password: await bcrypt.hash("correct-password", 4),
        });

        const response = await agent
            .patch(`/theaters/${theater._id}`)
            .send({ joining: true, userID, password: "correct-password" });

        expect(response.status).toBe(200);
    });

    it("rejects joining a full theater", async () => {
        const { agent, userID } = await loggedInUser();
        const theater = await seedTheater({
            amountOfSpaces: 1,
            usersInsideTheater: ["000000000000000000000003"],
        });

        const response = await agent
            .patch(`/theaters/${theater._id}`)
            .send({ joining: true, userID });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe("Theater is full");
    });

    it("rejects joining twice", async () => {
        const { agent, userID } = await loggedInUser();
        const theater = await seedTheater({ usersInsideTheater: [] });
        await agent.patch(`/theaters/${theater._id}`).send({ joining: true, userID });

        const response = await agent
            .patch(`/theaters/${theater._id}`)
            .send({ joining: true, userID });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe("You are already inside the theater");
    });

    it("rejects an update that is not a join", async () => {
        const { agent } = await loggedInUser();
        const theater = await seedTheater();

        const response = await agent
            .patch(`/theaters/${theater._id}`)
            .send({ eventName: "Renamed" });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe("Unsupported theater update");
    });
});

describe("DELETE /theaters/:id", () => {
    it("rejects deletion by a non-owner", async () => {
        const { agent } = await loggedInUser();
        const theater = await seedTheater({ ownerID: "000000000000000000000004" });

        const response = await agent.delete(`/theaters/${theater._id}`);

        expect(response.status).toBe(400);
        expect(response.body.message).toBe("Only the owner can delete the theater");
    });

    it("rejects deletion when the owner is not the sole occupant", async () => {
        const { agent, userID } = await loggedInUser();
        const theater = await seedTheater({
            ownerID: userID,
            usersInsideTheater: [userID, "000000000000000000000005"],
        });

        const response = await agent.delete(`/theaters/${theater._id}`);

        expect(response.status).toBe(400);
        expect(response.body.message).toBe("Owner must be the only one inside the theater");
    });

    it("deletes when the owner is alone inside", async () => {
        const { agent, userID } = await loggedInUser();
        const theater = await seedTheater({ ownerID: userID, usersInsideTheater: [userID] });

        const response = await agent.delete(`/theaters/${theater._id}`);

        expect(response.status).toBe(200);
        expect(response.body.message).toBe("Theater successfully deleted");

        const stored = await db.theaters.findOne({ _id: theater._id });
        expect(stored).toBeNull();
    });
});
