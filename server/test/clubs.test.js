import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../app.js";
import db from "../database/createConnection.js";
import { registerUser, loginAgent } from "./helpers.js";

// Phase 5: film clubs. The spec calls this the retention centrepiece — people
// stay for groups — so the parts that decide who may do what are the parts worth
// testing hardest.
async function loggedIn() {
    const user = await registerUser();
    const agent = await loginAgent(user);
    const stored = await db.users.findOne({ email: user.email.toLowerCase() });
    return { agent, user, userID: stored._id.toString() };
}

function validClub(overrides = {}) {
    return {
        name: "Thursday Noir",
        description: "Rain, hats, moral ambiguity.",
        isPublic: true,
        schedule: { weekday: 4, hour: 20, minute: 0, timeZone: "Europe/Copenhagen" },
        ...overrides,
    };
}

async function clubOwnedBy(owner, overrides = {}) {
    const response = await owner.agent.post("/clubs").send(validClub(overrides));
    expect(response.status).toBe(200);
    return response.body.data;
}

describe("creating a club", () => {
    it("makes the creator its owner", async () => {
        const owner = await loggedIn();

        const club = await clubOwnedBy(owner);

        const membership = await db.clubMembers.findOne({ clubID: club.id });
        expect(membership.userID).toBe(owner.userID);
        expect(membership.role).toBe("owner");
    });

    // The slug is in a URL, so it has to be derived from the name rather than
    // accepted from the client, and it has to be unique.
    it("derives a slug from the name", async () => {
        const owner = await loggedIn();

        const club = await clubOwnedBy(owner);

        expect(club.slug).toBe("thursday-noir");
    });

    it("gives a second club of the same name a distinct slug", async () => {
        const first = await loggedIn();
        const second = await loggedIn();

        await clubOwnedBy(first);
        const other = await clubOwnedBy(second);

        expect(other.slug).not.toBe("thursday-noir");
        expect(other.slug).toMatch(/^thursday-noir-/);
    });

    it.each([
        ["punctuation", "Thursday: Noir!", "thursday-noir"],
        ["accents", "Café Nuit", "cafe-nuit"],
        ["extra spaces", "  Thursday   Noir  ", "thursday-noir"],
    ])("handles %s in a name", async (_, name, expected) => {
        const owner = await loggedIn();

        const club = await clubOwnedBy(owner, { name });

        expect(club.slug).toBe(expected);
    });

    // A name of only punctuation leaves nothing to slug, and an empty slug in a
    // URL would collide with the club list itself.
    it("still produces a usable slug for a name with nothing to slug", async () => {
        const owner = await loggedIn();

        const club = await clubOwnedBy(owner, { name: "!!!" });

        expect(club.slug.length).toBeGreaterThan(0);
        expect(club.slug).not.toContain("/");
    });

    it("requires a session", async () => {
        const response = await request(app).post("/clubs").send(validClub());

        expect(response.status).toBe(401);
    });

    it.each([
        ["a weekday out of range", { weekday: 9, hour: 20, minute: 0, timeZone: "UTC" }],
        ["an hour out of range", { weekday: 1, hour: 25, minute: 0, timeZone: "UTC" }],
        ["a made-up timezone", { weekday: 1, hour: 20, minute: 0, timeZone: "Middle/Earth" }],
    ])("refuses %s", async (_, schedule) => {
        const owner = await loggedIn();

        const response = await owner.agent.post("/clubs").send(validClub({ schedule }));

        expect(response.status).toBe(400);
    });

    it("allows a club with no regular meeting", async () => {
        const owner = await loggedIn();

        const response = await owner.agent.post("/clubs").send(validClub({ schedule: null }));

        expect(response.status).toBe(200);
    });
});

describe("club membership", () => {
    it("lets someone join a public club", async () => {
        const owner = await loggedIn();
        const joiner = await loggedIn();
        const club = await clubOwnedBy(owner);

        const response = await joiner.agent.post(`/clubs/${club.id}/members`).send({});

        expect(response.status).toBe(200);
        expect(await db.clubMembers.countDocuments({ clubID: club.id })).toBe(2);
    });

    it("does not let someone join a private club uninvited", async () => {
        const owner = await loggedIn();
        const joiner = await loggedIn();
        const club = await clubOwnedBy(owner, { isPublic: false });

        const response = await joiner.agent.post(`/clubs/${club.id}/members`).send({});

        expect(response.status).toBe(403);
    });

    it("counts one person once, however many times they join", async () => {
        const owner = await loggedIn();
        const joiner = await loggedIn();
        const club = await clubOwnedBy(owner);

        await joiner.agent.post(`/clubs/${club.id}/members`).send({});
        const second = await joiner.agent.post(`/clubs/${club.id}/members`).send({});

        expect(second.status).toBe(400);
        expect(await db.clubMembers.countDocuments({ clubID: club.id })).toBe(2);
    });

    it("lets a member leave", async () => {
        const owner = await loggedIn();
        const member = await loggedIn();
        const club = await clubOwnedBy(owner);
        await member.agent.post(`/clubs/${club.id}/members`).send({});

        const response = await member.agent.delete(`/clubs/${club.id}/members/${member.userID}`);

        expect(response.status).toBe(200);
        expect(await db.clubMembers.countDocuments({ clubID: club.id })).toBe(1);
    });

    // A club with no owner has nobody who can delete it or promote anyone, so it
    // would sit there forever with no way to act on it.
    it("does not let the last owner leave", async () => {
        const owner = await loggedIn();
        const club = await clubOwnedBy(owner);

        const response = await owner.agent.delete(`/clubs/${club.id}/members/${owner.userID}`);

        expect(response.status).toBe(400);
        expect(response.body.message).toBe("A club must keep an owner");
    });

    it("lets an owner remove a member", async () => {
        const owner = await loggedIn();
        const member = await loggedIn();
        const club = await clubOwnedBy(owner);
        await member.agent.post(`/clubs/${club.id}/members`).send({});

        const response = await owner.agent.delete(`/clubs/${club.id}/members/${member.userID}`);

        expect(response.status).toBe(200);
    });

    it("does not let a member remove someone else", async () => {
        const owner = await loggedIn();
        const member = await loggedIn();
        const other = await loggedIn();
        const club = await clubOwnedBy(owner);
        await member.agent.post(`/clubs/${club.id}/members`).send({});
        await other.agent.post(`/clubs/${club.id}/members`).send({});

        const response = await member.agent.delete(`/clubs/${club.id}/members/${other.userID}`);

        expect(response.status).toBe(403);
    });
});

describe("club roles", () => {
    async function clubWithMember() {
        const owner = await loggedIn();
        const member = await loggedIn();
        const club = await clubOwnedBy(owner);
        await member.agent.post(`/clubs/${club.id}/members`).send({});
        return { owner, member, club };
    }

    it("lets an owner promote a member to moderator", async () => {
        const { owner, member, club } = await clubWithMember();

        const response = await owner.agent
            .patch(`/clubs/${club.id}/members/${member.userID}`)
            .send({ role: "moderator" });

        expect(response.status).toBe(200);
        const stored = await db.clubMembers.findOne({ clubID: club.id, userID: member.userID });
        expect(stored.role).toBe("moderator");
    });

    it("lets a moderator remove a member", async () => {
        const { owner, member, club } = await clubWithMember();
        const troublemaker = await loggedIn();
        await troublemaker.agent.post(`/clubs/${club.id}/members`).send({});
        await owner.agent
            .patch(`/clubs/${club.id}/members/${member.userID}`)
            .send({ role: "moderator" });

        const response = await member.agent.delete(
            `/clubs/${club.id}/members/${troublemaker.userID}`
        );

        expect(response.status).toBe(200);
    });

    // Otherwise a moderator could promote themselves and take the club.
    it("does not let a moderator change roles", async () => {
        const { owner, member, club } = await clubWithMember();
        await owner.agent
            .patch(`/clubs/${club.id}/members/${member.userID}`)
            .send({ role: "moderator" });

        const response = await member.agent
            .patch(`/clubs/${club.id}/members/${member.userID}`)
            .send({ role: "owner" });

        expect(response.status).toBe(403);
    });

    it("does not let a member change anyone's role", async () => {
        const { member, club } = await clubWithMember();

        const response = await member.agent
            .patch(`/clubs/${club.id}/members/${member.userID}`)
            .send({ role: "moderator" });

        expect(response.status).toBe(403);
    });

    it("does not let a stranger act on a club at all", async () => {
        const { club } = await clubWithMember();
        const stranger = await loggedIn();

        const response = await stranger.agent.delete(`/clubs/${club.id}`);

        expect(response.status).toBe(403);
    });

    it("lets an owner delete the club, taking its memberships with it", async () => {
        const { owner, club } = await clubWithMember();

        const response = await owner.agent.delete(`/clubs/${club.id}`);

        expect(response.status).toBe(200);
        expect(await db.clubs.countDocuments({})).toBe(0);
        expect(await db.clubMembers.countDocuments({ clubID: club.id })).toBe(0);
    });

    it("does not let a moderator delete the club", async () => {
        const { owner, member, club } = await clubWithMember();
        await owner.agent
            .patch(`/clubs/${club.id}/members/${member.userID}`)
            .send({ role: "moderator" });

        const response = await member.agent.delete(`/clubs/${club.id}`);

        expect(response.status).toBe(403);
    });
});

describe("reading a club", () => {
    it("shows the roster and when it next meets", async () => {
        const owner = await loggedIn();
        const club = await clubOwnedBy(owner);

        const response = await request(app).get(`/clubs/${club.slug}`);

        expect(response.status).toBe(200);
        expect(response.body.data.name).toBe("Thursday Noir");
        expect(response.body.data.members).toHaveLength(1);
        expect(response.body.data.members[0].username).toBe(owner.user.username);
        expect(new Date(response.body.data.nextMeeting).getTime()).toBeGreaterThan(Date.now());
        expect(response.body.data.scheduleText).toContain("Thursdays at 20:00");
    });

    // A private club answering 403 would confirm it exists, which is what
    // somebody guessing slugs is trying to establish.
    it("answers 404 for a private club, not 403", async () => {
        const owner = await loggedIn();
        const club = await clubOwnedBy(owner, { isPublic: false });

        const response = await request(app).get(`/clubs/${club.slug}`);

        expect(response.status).toBe(404);
    });

    it("shows a private club to its own members", async () => {
        const owner = await loggedIn();
        const club = await clubOwnedBy(owner, { isPublic: false });

        const response = await owner.agent.get(`/clubs/${club.slug}`);

        expect(response.status).toBe(200);
    });

    it("answers 404 for a slug that does not exist", async () => {
        const response = await request(app).get("/clubs/no-such-club");

        expect(response.status).toBe(404);
    });

    it("never exposes a member's email", async () => {
        const owner = await loggedIn();
        const club = await clubOwnedBy(owner);

        const response = await request(app).get(`/clubs/${club.slug}`);

        expect(JSON.stringify(response.body)).not.toContain(owner.user.email);
    });

    it("lists public clubs, and only public ones", async () => {
        const owner = await loggedIn();
        await clubOwnedBy(owner, { name: "Open Club" });
        const other = await loggedIn();
        await clubOwnedBy(other, { name: "Secret Club", isPublic: false });

        const response = await request(app).get("/clubs");

        expect(response.status).toBe(200);
        expect(response.body.data.map((club) => club.name)).toEqual(["Open Club"]);
    });
});
