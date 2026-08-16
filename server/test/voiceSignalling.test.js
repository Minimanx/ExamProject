import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { io as ioClient } from "socket.io-client";
import request from "supertest";
import { server, app } from "../app.js";
import db from "../database/createConnection.js";
import { limits } from "../limits.js";
import { registerUser, seedTheater, uniqueIp } from "./helpers.js";

/**
 * Phase 6: voice and camera over a peer-to-peer mesh.
 *
 * No media passes through this server, so these tests are about the only thing
 * that does — the introduction. Two properties have to hold here rather than in
 * the client, because a client that ignored either would be affecting other
 * people: the cap, which is what makes a mesh affordable at all, and the camera
 * gate, which decides who may point a camera at whom.
 */
let baseUrl;

beforeAll(async () => {
    await new Promise((resolve) => server.listen(0, resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
});

afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
});

function connect(extraHeaders = {}) {
    const socket = ioClient(baseUrl, {
        extraHeaders,
        transports: ["websocket", "polling"],
        reconnection: false,
    });
    return new Promise((resolve, reject) => {
        socket.on("connect", () => resolve(socket));
        socket.on("connect_error", reject);
    });
}

/** A logged-in person, sitting in `theater`, not yet in its call. */
async function seated(theater) {
    const user = await registerUser();
    const agent = request.agent(app);
    const login = await agent
        .post("/login")
        .set("X-Forwarded-For", uniqueIp())
        .send({ email: user.email, password: user.password });
    expect(login.status).toBe(200);

    const stored = await db.users.findOne({ email: user.email.toLowerCase() });
    const userID = stored._id.toString();
    await agent.patch(`/theaters/${theater._id}`).send({ joining: true, userID });

    const cookie = login.headers["set-cookie"].map((c) => c.split(";")[0]).join("; ");
    const socket = await connect({ Cookie: cookie });
    socket.emit("enteredTheater", { theaterId: theater._id.toString() });
    await new Promise((r) => setTimeout(r, 200));

    return { socket, userID, username: user.username };
}

/** Someone seated who has also joined the call, with what the server told them. */
async function inCall(theater) {
    const person = await seated(theater);
    const joined = await new Promise((resolve, reject) => {
        person.socket.once("voiceJoined", resolve);
        person.socket.once("voiceFull", (payload) => reject(new Error(payload.message)));
        person.socket.emit("voiceJoin");
    });
    return { ...person, joined };
}

async function collect(socket, event, act, ms = 400) {
    const seen = [];
    socket.on(event, (payload) => seen.push(payload));
    await act();
    await new Promise((r) => setTimeout(r, ms));
    socket.off(event);
    return seen;
}

const AUDIO_OFFER = {
    type: "offer",
    sdp: "v=0\r\no=- 1 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n",
};

const VIDEO_OFFER = {
    type: "offer",
    sdp:
        "v=0\r\no=- 1 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n" +
        "m=audio 9 UDP/TLS/RTP/SAVPF 111\r\nm=video 9 UDP/TLS/RTP/SAVPF 96\r\n",
};

describe("joining a lobby's call", () => {
    it("tells a joiner who is already there", async () => {
        const theater = await seedTheater({ eventName: "Voice: who is here" });
        const first = await inCall(theater);
        const second = await inCall(theater);

        try {
            expect(first.joined.peers).toEqual([]);
            expect(second.joined.peers.map((peer) => peer.username)).toEqual([first.username]);
        } finally {
            first.socket.close();
            second.socket.close();
        }
    });

    // Both sides offering is how a mesh ends up with two half-open connections
    // between one pair, so only the arriver is told to start.
    it("tells the people already there that someone arrived", async () => {
        const theater = await seedTheater({ eventName: "Voice: arrival" });
        const first = await inCall(theater);

        try {
            const seen = await collect(first.socket, "voicePeerJoined", async () => {
                const second = await inCall(theater);
                await new Promise((r) => setTimeout(r, 200));
                second.socket.close();
            });

            expect(seen).toHaveLength(1);
            expect(seen[0].id).toBeTruthy();
        } finally {
            first.socket.close();
        }
    });

    it("refuses someone who is not logged in", async () => {
        const theater = await seedTheater({ eventName: "Voice: anonymous" });
        const anonymous = await connect();

        try {
            anonymous.emit("enteredTheater", { theaterId: theater._id.toString() });
            const seen = await collect(anonymous, "voiceJoined", () => {
                anonymous.emit("voiceJoin");
            });

            expect(seen).toEqual([]);
        } finally {
            anonymous.close();
        }
    });

    it("refuses someone who is not in a theater at all", async () => {
        const user = await registerUser();
        const agent = request.agent(app);
        const login = await agent
            .post("/login")
            .set("X-Forwarded-For", uniqueIp())
            .send({ email: user.email, password: user.password });
        const cookie = login.headers["set-cookie"].map((c) => c.split(";")[0]).join("; ");
        const outside = await connect({ Cookie: cookie });

        try {
            const seen = await collect(outside, "voiceJoined", () => {
                outside.emit("voiceJoin");
            });

            expect(seen).toEqual([]);
        } finally {
            outside.close();
        }
    });
});

// The cap is what makes a mesh affordable: every participant connects to every
// other, so five people is twenty streams and ten is ninety. A client that
// ignored it would be degrading everyone else's call, not its own.
describe("the cap on a call", () => {
    it(`lets ${limits.voiceCapacity} people in and refuses the next`, async () => {
        const theater = await seedTheater({
            eventName: "Voice: full",
            amountOfSpaces: limits.voiceCapacity + 3,
        });
        const joined = [];

        try {
            for (let i = 0; i < limits.voiceCapacity; i++) {
                joined.push(await inCall(theater));
            }

            const extra = await seated(theater);
            joined.push(extra);

            const refusal = await new Promise((resolve, reject) => {
                extra.socket.once("voiceFull", resolve);
                extra.socket.once("voiceJoined", () => reject(new Error("was let in")));
                extra.socket.emit("voiceJoin");
                setTimeout(() => reject(new Error("no answer")), 3000);
            });

            expect(refusal.capacity).toBe(limits.voiceCapacity);
            expect(refusal.message).toMatch(/full/i);
        } finally {
            joined.forEach((person) => person.socket.close());
        }
    });

    // The count and the claim were separated by an await, so two people asking
    // at the same moment both saw room and both took it. A mesh over its cap is
    // not a refusal anyone sees — it is everybody's call getting worse.
    it("holds when more people ask at the same moment than there is room for", async () => {
        const theater = await seedTheater({
            eventName: "Voice: everyone at once",
            amountOfSpaces: limits.voiceCapacity + 5,
        });
        const seats = [];

        try {
            for (let i = 0; i < limits.voiceCapacity + 3; i++) {
                seats.push(await seated(theater));
            }

            const answers = seats.map(
                (person) =>
                    new Promise((resolve) => {
                        person.socket.once("voiceJoined", () => resolve("in"));
                        person.socket.once("voiceFull", () => resolve("refused"));
                        setTimeout(() => resolve("no answer"), 4000);
                    })
            );
            // All of them, without waiting for any one to be answered.
            seats.forEach((person) => person.socket.emit("voiceJoin"));

            const settled = await Promise.all(answers);
            expect(settled.filter((answer) => answer === "in")).toHaveLength(limits.voiceCapacity);
            expect(settled.filter((answer) => answer === "refused")).toHaveLength(3);
        } finally {
            seats.forEach((person) => person.socket.close());
        }
    });

    it("frees the place again when someone leaves", async () => {
        const theater = await seedTheater({
            eventName: "Voice: a place frees up",
            amountOfSpaces: limits.voiceCapacity + 3,
        });
        const joined = [];

        try {
            for (let i = 0; i < limits.voiceCapacity; i++) {
                joined.push(await inCall(theater));
            }

            joined.pop().socket.close();
            await new Promise((r) => setTimeout(r, 300));

            const late = await inCall(theater);
            joined.push(late);
            expect(late.joined.peers).toHaveLength(limits.voiceCapacity - 1);
        } finally {
            joined.forEach((person) => person.socket.close());
        }
    });
});

describe("passing signalling between two peers", () => {
    it("delivers an offer to the peer it names, and nobody else", async () => {
        const theater = await seedTheater({
            eventName: "Voice: addressed",
            amountOfSpaces: 10,
        });
        const first = await inCall(theater);
        const second = await inCall(theater);
        // Arrives last, so it was told about both of the others.
        const third = await inCall(theater);

        try {
            const heardByFirst = [];
            const heardBySecond = [];
            first.socket.on("voiceSignal", (payload) => heardByFirst.push(payload));
            second.socket.on("voiceSignal", (payload) => heardBySecond.push(payload));

            const addressed = third.joined.peers.find((peer) => peer.username === first.username);
            expect(addressed).toBeTruthy();

            third.socket.emit("voiceSignal", { to: addressed.id, description: AUDIO_OFFER });
            await new Promise((r) => setTimeout(r, 400));

            expect(heardByFirst).toHaveLength(1);
            expect(heardByFirst[0].description.type).toBe("offer");
            expect(heardByFirst[0].from).toBe(third.socket.id);
            // The third person is in the same call and heard nothing of it.
            expect(heardBySecond).toEqual([]);
        } finally {
            first.socket.close();
            second.socket.close();
            third.socket.close();
        }
    });

    it("does not carry signalling into another theater's call", async () => {
        const here = await seedTheater({ eventName: "Voice: here" });
        const elsewhere = await seedTheater({ eventName: "Voice: elsewhere" });
        const insider = await inCall(here);
        const outsider = await inCall(elsewhere);

        try {
            const seen = await collect(insider.socket, "voiceSignal", () => {
                outsider.socket.emit("voiceSignal", {
                    to: insider.socket.id,
                    description: AUDIO_OFFER,
                });
            });

            expect(seen).toEqual([]);
        } finally {
            insider.socket.close();
            outsider.socket.close();
        }
    });

    it("does not carry signalling from someone who never joined the call", async () => {
        const theater = await seedTheater({ eventName: "Voice: not in the call" });
        const inside = await inCall(theater);
        const lurker = await seated(theater);

        try {
            const seen = await collect(inside.socket, "voiceSignal", () => {
                lurker.socket.emit("voiceSignal", {
                    to: inside.socket.id,
                    description: AUDIO_OFFER,
                });
            });

            expect(seen).toEqual([]);
        } finally {
            inside.socket.close();
            lurker.socket.close();
        }
    });
});

// The gate that cannot live in the client: media never reaches this server, so
// the signalling is the only place it can be enforced.
describe("the camera gate", () => {
    it("refuses an offer carrying video to someone who is not a friend", async () => {
        const theater = await seedTheater({ eventName: "Voice: strangers" });
        // The first to arrive has an empty peer list by definition, so the
        // second is the one that can address anybody.
        const stranger = await inCall(theater);
        const pointsCamera = await inCall(theater);

        try {
            const refused = [];
            const delivered = [];
            pointsCamera.socket.on("voiceCameraRefused", (payload) => refused.push(payload));
            stranger.socket.on("voiceSignal", (payload) => delivered.push(payload));

            pointsCamera.socket.emit("voiceSignal", {
                to: pointsCamera.joined.peers[0].id,
                description: VIDEO_OFFER,
            });
            await new Promise((r) => setTimeout(r, 400));

            expect(refused).toHaveLength(1);
            expect(delivered).toEqual([]);
        } finally {
            stranger.socket.close();
            pointsCamera.socket.close();
        }
    });

    it("carries an audio-only offer between the same two", async () => {
        const theater = await seedTheater({ eventName: "Voice: strangers talking" });
        const first = await inCall(theater);
        const second = await inCall(theater);

        try {
            const seen = await collect(first.socket, "voiceSignal", () => {
                second.socket.emit("voiceSignal", {
                    to: second.joined.peers[0].id,
                    description: AUDIO_OFFER,
                });
            });

            expect(seen).toHaveLength(1);
            expect(seen[0].description.type).toBe("offer");
        } finally {
            first.socket.close();
            second.socket.close();
        }
    });

    it("carries video between two people who are friends", async () => {
        const theater = await seedTheater({ eventName: "Voice: friends" });
        const first = await inCall(theater);
        const second = await inCall(theater);

        await db.friendships.insertOne({
            ...(first.userID < second.userID
                ? { pairLow: first.userID, pairHigh: second.userID }
                : { pairLow: second.userID, pairHigh: first.userID }),
            requesterID: first.userID,
            state: "accepted",
            createdAt: new Date(),
        });

        try {
            const seen = await collect(first.socket, "voiceSignal", () => {
                second.socket.emit("voiceSignal", {
                    to: second.joined.peers[0].id,
                    description: VIDEO_OFFER,
                });
            });

            expect(seen).toHaveLength(1);
        } finally {
            first.socket.close();
            second.socket.close();
        }
    });

    // A request that has been sent but not accepted is not a relationship the
    // other person has agreed to.
    it("does not carry video on a friend request that was never accepted", async () => {
        const theater = await seedTheater({ eventName: "Voice: pending" });
        const first = await inCall(theater);
        const second = await inCall(theater);

        await db.friendships.insertOne({
            ...(first.userID < second.userID
                ? { pairLow: first.userID, pairHigh: second.userID }
                : { pairLow: second.userID, pairHigh: first.userID }),
            requesterID: second.userID,
            state: "pending",
            createdAt: new Date(),
        });

        try {
            const seen = await collect(first.socket, "voiceSignal", () => {
                second.socket.emit("voiceSignal", {
                    to: second.joined.peers[0].id,
                    description: VIDEO_OFFER,
                });
            });

            expect(seen).toEqual([]);
        } finally {
            first.socket.close();
            second.socket.close();
        }
    });
});

describe("leaving a call", () => {
    it("tells the others when someone disconnects", async () => {
        const theater = await seedTheater({ eventName: "Voice: dropped" });
        const stays = await inCall(theater);
        const goes = await inCall(theater);

        try {
            const seen = await collect(stays.socket, "voicePeerLeft", () => {
                goes.socket.close();
            });

            expect(seen).toHaveLength(1);
        } finally {
            stays.socket.close();
        }
    });

    // chatSocket clears the theater off the socket on the same event, so this
    // is the case that breaks if the call reads the socket's current theater
    // rather than the one it joined in.
    it("tells the others when someone walks out of the theater", async () => {
        const theater = await seedTheater({ eventName: "Voice: walked out" });
        const stays = await inCall(theater);
        const goes = await inCall(theater);

        try {
            const seen = await collect(stays.socket, "voicePeerLeft", () => {
                goes.socket.emit("leftTheater");
            });

            expect(seen).toHaveLength(1);
        } finally {
            stays.socket.close();
            goes.socket.close();
        }
    });
});
