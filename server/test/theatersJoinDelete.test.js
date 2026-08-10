import { describe, it, expect } from "vitest";
import request from "supertest";
import bcrypt from "bcrypt";
import { app } from "../app.js";
import db from "../database/createConnection.js";
import { registerUser, loginAgent, seedTheater } from "./helpers.js";

/** An occupant entry as the join route writes it. */
function occupant(userID, joinedAt = new Date()) {
    return { userID, joinedAt };
}

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

        expect(response.status).toBe(401);
        expect(response.body.message).toBe("Must be logged in to join theater");
    });

    it("rejects a body userID that does not match the session", async () => {
        const { agent } = await loggedInUser();
        const theater = await seedTheater();

        const response = await agent
            .patch(`/theaters/${theater._id}`)
            .send({ joining: true, userID: "000000000000000000000002" });

        expect(response.status).toBe(401);
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
        expect(stored.usersInsideTheater.map((occupant) => occupant.userID)).toEqual([userID]);
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

        expect(response.status).toBe(403);
        expect(response.body.message).toBe("Password doesn't match");
    });

    // bcrypt.compare throws on a non-string, so a join that simply omits the
    // password reached it and turned a malformed request into a 500.
    it("rejects joining a locked theater with no password at all", async () => {
        const { agent, userID } = await loggedInUser();
        const theater = await seedTheater({
            passwordBool: true,
            password: await bcrypt.hash("correct-password", 4),
        });

        const response = await agent
            .patch(`/theaters/${theater._id}`)
            .send({ joining: true, userID });

        expect(response.status).toBe(403);
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
            usersInsideTheater: [occupant("000000000000000000000003")],
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

        expect(response.status).toBe(403);
        expect(response.body.message).toBe("Only the owner can delete the theater");
    });

    it("rejects deletion when the owner is not the sole occupant", async () => {
        const { agent, userID } = await loggedInUser();
        const theater = await seedTheater({
            ownerID: userID,
            usersInsideTheater: [occupant(userID), occupant("000000000000000000000005")],
        });

        const response = await agent.delete(`/theaters/${theater._id}`);

        expect(response.status).toBe(400);
        expect(response.body.message).toBe("Owner must be the only one inside the theater");
    });

    it("deletes when the owner is alone inside", async () => {
        const { agent, userID } = await loggedInUser();
        const theater = await seedTheater({
            ownerID: userID,
            usersInsideTheater: [occupant(userID)],
        });

        const response = await agent.delete(`/theaters/${theater._id}`);

        expect(response.status).toBe(200);
        expect(response.body.message).toBe("Theater successfully deleted");

        const stored = await db.theaters.findOne({ _id: theater._id });
        expect(stored).toBeNull();
    });
});

// DEFECT C5 (roadmap spec §5): an occupant was added to usersInsideTheater by
// the HTTP join and removed by the socket's disconnect handler. Anything that
// broke that pairing — a tab closed before the socket opened, a dropped
// connection, a server restart — left a ghost holding a seat for the life of
// the theater. Nothing ever reconciled the list against who was actually there.
describe("ghost occupants (defect C5)", () => {
    const OUTSIDE_GRACE = new Date(Date.now() - 5 * 60 * 1000);

    it("frees a seat held by someone who never opened a socket", async () => {
        const { agent, userID } = await loggedInUser();
        const theater = await seedTheater({
            amountOfSpaces: 1,
            usersInsideTheater: [occupant("000000000000000000000003", OUTSIDE_GRACE)],
        });

        const response = await agent
            .patch(`/theaters/${theater._id}`)
            .send({ joining: true, userID });

        expect(response.status).toBe(200);
    });

    // The join and the socket handshake are two round trips. Sweeping on the
    // absence of a socket alone would evict people between them.
    it("holds the seat of someone who has only just joined", async () => {
        const { agent, userID } = await loggedInUser();
        const theater = await seedTheater({
            amountOfSpaces: 1,
            usersInsideTheater: [occupant("000000000000000000000003")],
        });

        const response = await agent
            .patch(`/theaters/${theater._id}`)
            .send({ joining: true, userID });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe("Theater is full");
    });

    // Documents written before this change hold bare id strings with no join
    // time. They have no live socket either, so they sweep on first contact.
    it("sweeps occupants recorded in the old string format", async () => {
        const { agent, userID } = await loggedInUser();
        const theater = await seedTheater({
            amountOfSpaces: 1,
            usersInsideTheater: ["000000000000000000000003"],
        });

        const response = await agent
            .patch(`/theaters/${theater._id}`)
            .send({ joining: true, userID });

        expect(response.status).toBe(200);
    });

    it("persists the sweep rather than recomputing it every read", async () => {
        const theater = await seedTheater({
            usersInsideTheater: [occupant("000000000000000000000003", OUTSIDE_GRACE)],
        });

        await request(app).get("/theaters");

        const stored = await db.theaters.findOne({ _id: theater._id });
        expect(stored.usersInsideTheater).toEqual([]);
    });

    it("reports the swept count in the listing", async () => {
        await seedTheater({
            eventName: "Haunted",
            usersInsideTheater: [
                occupant("000000000000000000000003", OUTSIDE_GRACE),
                occupant("000000000000000000000004"),
            ],
        });

        const response = await request(app).get("/theaters");
        const listed = response.body.data.find((t) => t.eventName === "Haunted");

        expect(listed.usersInsideTheater).toHaveLength(1);
    });
});
