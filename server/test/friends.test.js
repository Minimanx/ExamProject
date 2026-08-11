import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../app.js";
import db from "../database/createConnection.js";
import { registerUser, loginAgent } from "./helpers.js";

// Phase 5: friends. A friendship is symmetric, so it is one row describing the
// pair rather than two rows describing directions — see the plan for why the
// unique index is what forces that choice.
async function loggedIn(overrides) {
    const user = await registerUser(overrides);
    const agent = await loginAgent(user);
    const stored = await db.users.findOne({ email: user.email.toLowerCase() });
    return { agent, user, userID: stored._id.toString() };
}

describe("requesting a friend", () => {
    it("creates a pending request", async () => {
        const asker = await loggedIn();
        const target = await loggedIn();

        const response = await asker.agent
            .post("/friends")
            .send({ username: target.user.username });

        expect(response.status).toBe(200);
        const stored = await db.friendships.findOne({});
        expect(stored.state).toBe("pending");
        expect(stored.requesterID).toBe(asker.userID);
    });

    it("refuses an unknown username", async () => {
        const asker = await loggedIn();

        const response = await asker.agent.post("/friends").send({ username: "nobody-here" });

        expect(response.status).toBe(404);
    });

    it("refuses to befriend yourself", async () => {
        const asker = await loggedIn();

        const response = await asker.agent.post("/friends").send({ username: asker.user.username });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe("You cannot add yourself");
    });

    it("requires a session", async () => {
        const target = await loggedIn();

        const response = await request(app)
            .post("/friends")
            .send({ username: target.user.username });

        expect(response.status).toBe(401);
    });

    it("refuses a second request to the same person", async () => {
        const asker = await loggedIn();
        const target = await loggedIn();
        await asker.agent.post("/friends").send({ username: target.user.username });

        const response = await asker.agent
            .post("/friends")
            .send({ username: target.user.username });

        expect(response.status).toBe(400);
        expect(await db.friendships.countDocuments({})).toBe(1);
    });

    // The reason the pair is stored in a canonical order. Without it the index
    // cannot see that (A,B) and (B,A) are the same relationship, and two people
    // adding each other at the same moment would create two friendships.
    it("treats a request in the other direction as the same relationship", async () => {
        const first = await loggedIn();
        const second = await loggedIn();
        await first.agent.post("/friends").send({ username: second.user.username });

        const response = await second.agent
            .post("/friends")
            .send({ username: first.user.username });

        expect(response.status).toBe(400);
        expect(await db.friendships.countDocuments({})).toBe(1);
    });

    it("lets exactly one of two simultaneous requests through", async () => {
        const first = await loggedIn();
        const second = await loggedIn();

        const responses = await Promise.all([
            first.agent.post("/friends").send({ username: second.user.username }),
            second.agent.post("/friends").send({ username: first.user.username }),
        ]);

        expect(responses.filter((response) => response.status === 200)).toHaveLength(1);
        expect(await db.friendships.countDocuments({})).toBe(1);
    });
});

describe("answering a request", () => {
    async function pendingBetween() {
        const asker = await loggedIn();
        const target = await loggedIn();
        await asker.agent.post("/friends").send({ username: target.user.username });
        const friendship = await db.friendships.findOne({});
        return { asker, target, id: friendship._id.toString() };
    }

    it("lets the addressee accept", async () => {
        const { target, id } = await pendingBetween();

        const response = await target.agent.patch(`/friends/${id}`).send({ accept: true });

        expect(response.status).toBe(200);
        expect((await db.friendships.findOne({})).state).toBe("accepted");
    });

    it("lets the addressee decline, which removes the request", async () => {
        const { target, id } = await pendingBetween();

        const response = await target.agent.patch(`/friends/${id}`).send({ accept: false });

        expect(response.status).toBe(200);
        expect(await db.friendships.countDocuments({})).toBe(0);
    });

    // Otherwise anyone could befriend anyone by asking and then agreeing.
    it("does not let the person who asked accept their own request", async () => {
        const { asker, id } = await pendingBetween();

        const response = await asker.agent.patch(`/friends/${id}`).send({ accept: true });

        expect(response.status).toBe(403);
        expect((await db.friendships.findOne({})).state).toBe("pending");
    });

    it("does not let a stranger answer someone else's request", async () => {
        const { id } = await pendingBetween();
        const stranger = await loggedIn();

        const response = await stranger.agent.patch(`/friends/${id}`).send({ accept: true });

        expect(response.status).toBe(403);
    });

    it("answers 404 for a request that does not exist", async () => {
        const someone = await loggedIn();

        const response = await someone.agent
            .patch("/friends/000000000000000000000001")
            .send({ accept: true });

        expect(response.status).toBe(404);
    });

    it("refuses to accept a friendship that is already accepted", async () => {
        const { target, id } = await pendingBetween();
        await target.agent.patch(`/friends/${id}`).send({ accept: true });

        const response = await target.agent.patch(`/friends/${id}`).send({ accept: true });

        expect(response.status).toBe(400);
    });
});

describe("removing a friend", () => {
    async function acceptedBetween() {
        const asker = await loggedIn();
        const target = await loggedIn();
        await asker.agent.post("/friends").send({ username: target.user.username });
        const friendship = await db.friendships.findOne({});
        await target.agent.patch(`/friends/${friendship._id}`).send({ accept: true });
        return { asker, target, id: friendship._id.toString() };
    }

    it.each(["asker", "target"])("lets the %s remove the friendship", async (who) => {
        const parties = await acceptedBetween();

        const response = await parties[who].agent.delete(`/friends/${parties.id}`);

        expect(response.status).toBe(200);
        expect(await db.friendships.countDocuments({})).toBe(0);
    });

    it("does not let a stranger remove someone else's friendship", async () => {
        const { id } = await acceptedBetween();
        const stranger = await loggedIn();

        const response = await stranger.agent.delete(`/friends/${id}`);

        expect(response.status).toBe(403);
        expect(await db.friendships.countDocuments({})).toBe(1);
    });
});

describe("listing friends", () => {
    it("separates accepted friends from requests in each direction", async () => {
        const me = await loggedIn();
        const friend = await loggedIn();
        const wantsToBeFriends = await loggedIn();
        const iAsked = await loggedIn();

        await me.agent.post("/friends").send({ username: friend.user.username });
        const accepted = await db.friendships.findOne({});
        await friend.agent.patch(`/friends/${accepted._id}`).send({ accept: true });

        await wantsToBeFriends.agent.post("/friends").send({ username: me.user.username });
        await me.agent.post("/friends").send({ username: iAsked.user.username });

        const response = await me.agent.get("/friends");

        expect(response.status).toBe(200);
        expect(response.body.data.friends.map((f) => f.username)).toEqual([friend.user.username]);
        expect(response.body.data.incoming.map((f) => f.username)).toEqual([
            wantsToBeFriends.user.username,
        ]);
        expect(response.body.data.outgoing.map((f) => f.username)).toEqual([iAsked.user.username]);
    });

    it("says whether each friend is online", async () => {
        const me = await loggedIn();
        const friend = await loggedIn();
        await me.agent.post("/friends").send({ username: friend.user.username });
        const friendship = await db.friendships.findOne({});
        await friend.agent.patch(`/friends/${friendship._id}`).send({ accept: true });

        const response = await me.agent.get("/friends");

        // Nobody has a socket open in this test, so the honest answer is false —
        // what matters is that the field is there and is a boolean rather than
        // missing, which a client would read as "offline" by accident.
        expect(response.body.data.friends[0].online).toBe(false);
    });

    it("never leaks an email address", async () => {
        const me = await loggedIn();
        const friend = await loggedIn();
        await me.agent.post("/friends").send({ username: friend.user.username });

        const response = await me.agent.get("/friends");

        expect(JSON.stringify(response.body)).not.toContain(friend.user.email);
    });

    it("requires a session", async () => {
        const response = await request(app).get("/friends");

        expect(response.status).toBe(401);
    });
});

// "Join a friend" needs to know where they are. That is a real disclosure —
// interest management exists precisely so players cannot see everyone's
// position — so it is answered only for an accepted friendship, and only to the
// other half of it.
describe("finding a friend", () => {
    async function acceptedBetween() {
        const me = await loggedIn();
        const friend = await loggedIn();
        await me.agent.post("/friends").send({ username: friend.user.username });
        const friendship = await db.friendships.findOne({});
        await friend.agent.patch(`/friends/${friendship._id}`).send({ accept: true });
        return { me, friend, id: friendship._id.toString() };
    }

    it("says where an accepted friend is", async () => {
        const { me } = await acceptedBetween();

        const response = await me.agent.get(
            `/friends/${(await db.friendships.findOne({}))._id}/whereabouts`
        );

        expect(response.status).toBe(200);
        // Nobody has a socket open here, so they are nowhere — the shape is what
        // matters, and that "offline" is expressible rather than an error.
        expect(response.body.data).toEqual({ online: false, position: null, theaterId: null });
    });

    it("refuses while the request is only pending", async () => {
        const asker = await loggedIn();
        const target = await loggedIn();
        await asker.agent.post("/friends").send({ username: target.user.username });
        const friendship = await db.friendships.findOne({});

        const response = await asker.agent.get(`/friends/${friendship._id}/whereabouts`);

        expect(response.status).toBe(403);
    });

    it("refuses a stranger asking about someone else's friendship", async () => {
        const { id } = await acceptedBetween();
        const stranger = await loggedIn();

        const response = await stranger.agent.get(`/friends/${id}/whereabouts`);

        expect(response.status).toBe(403);
    });

    it("requires a session", async () => {
        const { id } = await acceptedBetween();

        const response = await request(app).get(`/friends/${id}/whereabouts`);

        expect(response.status).toBe(401);
    });
});
