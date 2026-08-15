import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { io as ioClient } from "socket.io-client";
import request from "supertest";
import { server, app } from "../app.js";
import { registerUser, uniqueIp } from "./helpers.js";
import db from "../database/createConnection.js";
import { PROXIMITY_RADIUS } from "../socketios/carSocket.js";

// Phase 3 exit criterion: two people can chat in the open world. A message is a
// speech bubble over the sender's car, delivered only to players near enough to
// have plausibly heard it.
//
// Range is decided by the server from the positions it already receives. Doing
// it in the client would mean broadcasting every message to everyone and asking
// each client to discard the ones it should not see, which is not a range limit
// at all — it is a rendering convention a modified client ignores.
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

/** A socket carrying a real logged-in session, parked at a world position. */
async function connectAt(worldX, worldY = 600) {
    const user = await registerUser();
    const agent = request.agent(app);
    const login = await agent
        .post("/login")
        .set("X-Forwarded-For", uniqueIp())
        .send({ email: user.email, password: user.password });
    expect(login.status).toBe(200);

    const cookie = login.headers["set-cookie"].map((c) => c.split(";")[0]).join("; ");
    const socket = await connect({ Cookie: cookie });

    // Entering the world is its own step, and a real client always takes it:
    // `carJoined` is what puts a car in the hub, and `carPosition` only moves
    // one that is already there. Skipping it here tested a path no client takes.
    await new Promise((resolve) => {
        socket.once("hubAssigned", resolve);
        socket.emit("carJoined", {
            coords: { x: 0, y: worldY },
            color: "#fff",
            name: user.username,
            screen: worldX,
        });
    });

    // The client reports a screen-space x plus the scroll offset, so world x is
    // their sum. Reporting it all as scroll keeps the arithmetic obvious here.
    socket.emit("carPosition", { coords: { x: 0, y: worldY }, direction: false, screen: worldX });
    await new Promise((r) => setTimeout(r, 100));
    return { socket, username: user.username };
}

async function collect(watcher, event, act, ms = 400) {
    const seen = [];
    watcher.on(event, (payload) => seen.push(payload));
    await act();
    await new Promise((r) => setTimeout(r, ms));
    watcher.off(event);
    return seen;
}

describe("proximity chat", () => {
    it("reaches someone standing nearby", async () => {
        const near = await connectAt(100);
        const speaker = await connectAt(200);

        try {
            const seen = await collect(near.socket, "newHubMessage", () => {
                speaker.socket.emit("hubMessage", { text: "anyone watching tonight?" });
            });

            expect(seen.map((m) => m.text)).toEqual(["anyone watching tonight?"]);
            expect(seen[0].username).toBe(speaker.username);
        } finally {
            near.socket.close();
            speaker.socket.close();
        }
    });

    it("does not reach someone across the world", async () => {
        const far = await connectAt(100 + PROXIMITY_RADIUS * 4);
        const speaker = await connectAt(100);

        try {
            const seen = await collect(far.socket, "newHubMessage", () => {
                speaker.socket.emit("hubMessage", { text: "hello?" });
            });

            expect(seen).toEqual([]);
        } finally {
            far.socket.close();
            speaker.socket.close();
        }
    });

    // Otherwise you cannot tell whether your own message went out.
    it("shows the speaker their own bubble", async () => {
        const speaker = await connectAt(100);

        try {
            const seen = await collect(speaker.socket, "newHubMessage", () => {
                speaker.socket.emit("hubMessage", { text: "talking to myself" });
            });

            expect(seen.map((m) => m.text)).toEqual(["talking to myself"]);
        } finally {
            speaker.socket.close();
        }
    });

    it("carries the speaker's id so the bubble can find their car", async () => {
        const listener = await connectAt(100);
        const speaker = await connectAt(150);

        try {
            const seen = await collect(listener.socket, "newHubMessage", () => {
                speaker.socket.emit("hubMessage", { text: "over here" });
            });

            expect(seen[0].id).toBe(speaker.socket.id);
        } finally {
            listener.socket.close();
            speaker.socket.close();
        }
    });

    // Distance is meaningless for someone whose position was never reported,
    // and treating unknown as zero would put them next to everyone.
    it("does not reach a socket that has never reported a position", async () => {
        const user = await registerUser();
        const agent = request.agent(app);
        const login = await agent
            .post("/login")
            .set("X-Forwarded-For", uniqueIp())
            .send({ email: user.email, password: user.password });
        const cookie = login.headers["set-cookie"].map((c) => c.split(";")[0]).join("; ");
        const silent = await connect({ Cookie: cookie });
        const speaker = await connectAt(100);

        try {
            const seen = await collect(silent, "newHubMessage", () => {
                speaker.socket.emit("hubMessage", { text: "anybody" });
            });

            expect(seen).toEqual([]);
        } finally {
            silent.close();
            speaker.socket.close();
        }
    });

    // A player who logs in and never presses a key still has a car on the map:
    // `carJoined` carries the spawn position. Recording a position only on
    // movement would make two people who just arrived unable to hear each other,
    // which is precisely the moment they would want to talk.
    it("reaches someone who has joined but never moved", async () => {
        const user = await registerUser();
        const agent = request.agent(app);
        const login = await agent
            .post("/login")
            .set("X-Forwarded-For", uniqueIp())
            .send({ email: user.email, password: user.password });
        const cookie = login.headers["set-cookie"].map((c) => c.split(";")[0]).join("; ");
        const stationary = await connect({ Cookie: cookie });
        stationary.emit("carJoined", {
            coords: { x: 60, y: 600 },
            color: "#fff",
            name: "parked",
            screen: 0,
        });
        await new Promise((r) => setTimeout(r, 100));

        const speaker = await connectAt(60);

        try {
            const seen = await collect(stationary, "newHubMessage", () => {
                speaker.socket.emit("hubMessage", { text: "just got here" });
            });

            expect(seen.map((m) => m.text)).toEqual(["just got here"]);
        } finally {
            stationary.close();
            speaker.socket.close();
        }
    });

    it("ignores a message from a socket with no session", async () => {
        const listener = await connectAt(100);
        const anonymous = await connect();

        try {
            const seen = await collect(listener.socket, "newHubMessage", () => {
                anonymous.emit("carPosition", { coords: { x: 0, y: 600 }, screen: 100 });
                anonymous.emit("hubMessage", { text: "let me in" });
            });

            expect(seen).toEqual([]);
        } finally {
            listener.socket.close();
            anonymous.close();
        }
    });

    // The same limits as theater chat, because it is the same risk: nothing
    // else bounds what a modified client can push into everyone's view.
    it("drops an over-long message", async () => {
        const listener = await connectAt(100);
        const speaker = await connectAt(150);

        try {
            const seen = await collect(listener.socket, "newHubMessage", () => {
                speaker.socket.emit("hubMessage", { text: "x".repeat(5000) });
            });

            expect(seen).toEqual([]);
        } finally {
            listener.socket.close();
            speaker.socket.close();
        }
    });

    it.each([[42], [null], [{ nested: "object" }], [["array"]]])(
        "drops a message whose text is %j",
        async (text) => {
            const listener = await connectAt(100);
            const speaker = await connectAt(150);

            try {
                const seen = await collect(listener.socket, "newHubMessage", () => {
                    speaker.socket.emit("hubMessage", { text });
                });

                expect(seen).toEqual([]);
            } finally {
                listener.socket.close();
                speaker.socket.close();
            }
        }
    );

    it("drops an empty message rather than showing an empty bubble", async () => {
        const listener = await connectAt(100);
        const speaker = await connectAt(150);

        try {
            const seen = await collect(listener.socket, "newHubMessage", () => {
                speaker.socket.emit("hubMessage", { text: "   " });
            });

            expect(seen).toEqual([]);
        } finally {
            listener.socket.close();
            speaker.socket.close();
        }
    });

    it("rate limits a flood", async () => {
        const listener = await connectAt(100);
        const speaker = await connectAt(150);

        try {
            const seen = await collect(
                listener.socket,
                "newHubMessage",
                () => {
                    for (let i = 0; i < 30; i++) {
                        speaker.socket.emit("hubMessage", { text: `spam ${i}` });
                    }
                },
                600
            );

            expect(seen.length).toBeLessThanOrEqual(10);
            expect(seen.length).toBeGreaterThan(0);
        } finally {
            listener.socket.close();
            speaker.socket.close();
        }
    });
});

// Phase 4: the world stopped being one implicit global broadcast. Every socket
// belongs to a hub instance and world events address that instance's room.
//
// With one instance configured nothing observable changes, which is exactly why
// it needs a test: a seam that is never exercised is not there when Phase 11
// needs it.
describe("hub instances", () => {
    it("puts a joining player in an instance and tells them which", async () => {
        const user = await registerUser();
        const agent = request.agent(app);
        const login = await agent
            .post("/login")
            .set("X-Forwarded-For", uniqueIp())
            .send({ email: user.email, password: user.password });
        const cookie = login.headers["set-cookie"].map((c) => c.split(";")[0]).join("; ");
        const socket = await connect({ Cookie: cookie });

        try {
            const assigned = await new Promise((resolve) => {
                socket.on("hubAssigned", resolve);
                socket.emit("carJoined", {
                    coords: { x: 60, y: 600 },
                    color: "#fff",
                    name: "someone",
                    screen: 0,
                });
            });

            expect(assigned.instanceId).toMatch(/^hub-\d+$/);
        } finally {
            socket.close();
        }
    });

    it("does not put an unauthenticated socket in an instance", async () => {
        const listener = await connectAt(100);
        const anonymous = await connect();

        try {
            const seen = await collect(anonymous, "hubAssigned", () => {
                anonymous.emit("carJoined", {
                    coords: { x: 60, y: 600 },
                    color: "#fff",
                    name: "nobody",
                    screen: 0,
                });
            });

            expect(seen).toEqual([]);
        } finally {
            listener.socket.close();
            anonymous.close();
        }
    });
});

// Phase 4: positions are the server's, not the client's. The unit tests cover
// the arithmetic; these cover that the socket actually applies it, and that a
// refused client is told where it really is rather than drifting away unaware.
describe("server-held positions", () => {
    async function connectInWorld() {
        const user = await registerUser();
        const agent = request.agent(app);
        const login = await agent
            .post("/login")
            .set("X-Forwarded-For", uniqueIp())
            .send({ email: user.email, password: user.password });
        const cookie = login.headers["set-cookie"].map((c) => c.split(";")[0]).join("; ");
        const socket = await connect({ Cookie: cookie });
        socket.emit("carJoined", {
            coords: { x: 60, y: 600 },
            color: "#fff",
            name: "p",
            screen: 0,
        });
        await new Promise((r) => setTimeout(r, 150));
        return socket;
    }

    it("does not relay a teleport", async () => {
        const watcher = await connectInWorld();
        const cheat = await connectInWorld();

        try {
            const seen = await collect(watcher, "newCarPosition", () => {
                cheat.emit("carPosition", { coords: { x: 0, y: 600 }, screen: 40000 });
            });

            expect(seen).toEqual([]);
        } finally {
            watcher.close();
            cheat.close();
        }
    });

    it("tells the refused client where it actually is", async () => {
        const cheat = await connectInWorld();

        try {
            const corrections = await collect(cheat, "positionCorrection", () => {
                cheat.emit("carPosition", { coords: { x: 0, y: 600 }, screen: 40000 });
            });

            expect(corrections).toHaveLength(1);
            expect(corrections[0]).toMatchObject({ x: expect.any(Number), y: expect.any(Number) });
            expect(corrections[0].x).toBeLessThan(1000);
        } finally {
            cheat.close();
        }
    });

    it("relays an ordinary step", async () => {
        const watcher = await connectInWorld();
        const player = await connectInWorld();

        try {
            const seen = await collect(watcher, "newCarPosition", () => {
                player.emit("carPosition", { coords: { x: 70, y: 600 }, screen: 0 });
            });

            expect(seen).toHaveLength(1);
        } finally {
            watcher.close();
            player.close();
        }
    });

    // The point of the whole exercise: a spoofed position was a way to hear
    // conversations anywhere in the world.
    it("does not let a spoofed position eavesdrop across the world", async () => {
        const eavesdropper = await connectInWorld();
        const speaker = await connectAt(100 + PROXIMITY_RADIUS * 6);

        try {
            // Claim to be standing next to them. The server keeps the position
            // it accepted, which is back at the spawn point.
            eavesdropper.emit("carPosition", {
                coords: { x: 0, y: 600 },
                screen: 100 + PROXIMITY_RADIUS * 6,
            });
            await new Promise((r) => setTimeout(r, 150));

            const seen = await collect(eavesdropper, "newHubMessage", () => {
                speaker.socket.emit("hubMessage", { text: "not for you" });
            });

            expect(seen).toEqual([]);
        } finally {
            eavesdropper.close();
            speaker.socket.close();
        }
    });

    // Walking into a theater takes your car out of the world — `joinedTheater`
    // removes it from the grid and tells everyone watching. What it does not
    // clear is the last position that car was standing at, and delivery walked
    // every socket on the server comparing exactly that. So you sat down to
    // watch a film and kept receiving speech bubbles from whoever happened to be
    // parked near the space you left.
    it("stops reaching someone once they have gone into a theater", async () => {
        const filmgoer = await connectAt(100);
        const speaker = await connectAt(120);

        try {
            filmgoer.socket.emit("joinedTheater");
            await new Promise((r) => setTimeout(r, 150));

            const seen = await collect(filmgoer.socket, "newHubMessage", () => {
                speaker.socket.emit("hubMessage", { text: "still out here" });
            });

            expect(seen).toEqual([]);
        } finally {
            filmgoer.socket.close();
            speaker.socket.close();
        }
    });

    // The same hole from the other side: someone sitting in a theater is not
    // standing in the hub, so nothing they say belongs there.
    it("does not let someone inside a theater speak into the hub", async () => {
        const listener = await connectAt(100);
        const filmgoer = await connectAt(120);

        try {
            filmgoer.socket.emit("joinedTheater");
            await new Promise((r) => setTimeout(r, 150));

            const seen = await collect(listener.socket, "newHubMessage", () => {
                filmgoer.socket.emit("hubMessage", { text: "from inside the theater" });
            });

            expect(seen).toEqual([]);
        } finally {
            listener.socket.close();
            filmgoer.socket.close();
        }
    });
});

// Phase 4 exit criterion: a client only receives position updates for players it
// can see. Crossing the boundary has to be an event in its own right — without
// enter and leave, interest management looks exactly like a bug, with cars
// freezing where they were last seen and never coming back.
describe("spatial interest management", () => {
    async function joinAt(worldX) {
        const user = await registerUser();
        const agent = request.agent(app);
        const login = await agent
            .post("/login")
            .set("X-Forwarded-For", uniqueIp())
            .send({ email: user.email, password: user.password });
        const cookie = login.headers["set-cookie"].map((c) => c.split(";")[0]).join("; ");
        const socket = await connect({ Cookie: cookie });
        socket.emit("carJoined", {
            coords: { x: 0, y: 600 },
            color: "#fff",
            name: "player",
            screen: worldX,
        });
        await new Promise((r) => setTimeout(r, 150));
        return socket;
    }

    /**
     * Drive across the world at a speed the server will accept.
     *
     * Positions are validated at 250 px/s now, so a test that jumps 200px every
     * 60ms is refused on every step and the car never moves — which looks
     * exactly like interest management being broken. Each step waits long enough
     * to have been driven.
     */
    async function driveTo(socket, fromX, toX) {
        const step = 100;
        const perStepMs = (step / 250) * 1000 + 60;
        const direction = Math.sign(toX - fromX);

        for (let at = fromX; direction > 0 ? at < toX : at > toX; at += step * direction) {
            socket.emit("carPosition", { coords: { x: 0, y: 600 }, screen: at, direction: false });
            await new Promise((r) => setTimeout(r, perStepMs));
        }
        socket.emit("carPosition", { coords: { x: 0, y: 600 }, screen: toX, direction: false });
        await new Promise((r) => setTimeout(r, 200));
    }

    it("does not send positions for someone across the world", async () => {
        const watcher = await joinAt(0);
        const distant = await joinAt(6000);

        try {
            const seen = await collect(watcher, "newCarPosition", () => {
                distant.emit("carPosition", { coords: { x: 0, y: 601 }, screen: 6000 });
            });

            expect(seen).toEqual([]);
        } finally {
            watcher.close();
            distant.close();
        }
    });

    it("sends positions for someone nearby", async () => {
        const watcher = await joinAt(0);
        const neighbour = await joinAt(200);

        try {
            const seen = await collect(watcher, "newCarPosition", () => {
                neighbour.emit("carPosition", { coords: { x: 0, y: 601 }, screen: 200 });
            });

            expect(seen.length).toBeGreaterThan(0);
        } finally {
            watcher.close();
            neighbour.close();
        }
    });

    // Everything a car does, not just where it is. Repainting a car and renaming
    // one went to the whole instance, so a client was told about the appearance
    // of cars it had never been told existed — and would be told about again,
    // from scratch, if it ever drove close enough to see one.
    it("does not send a colour change from someone across the world", async () => {
        const watcher = await joinAt(0);
        const distant = await joinAt(6000);

        try {
            const seen = await collect(watcher, "newColorChanged", () => {
                distant.emit("colorChanged", { color: "#ff0000" });
            });

            expect(seen).toEqual([]);
        } finally {
            watcher.close();
            distant.close();
        }
    });

    it("sends a colour change from someone nearby", async () => {
        const watcher = await joinAt(0);
        const neighbour = await joinAt(200);

        try {
            const seen = await collect(watcher, "newColorChanged", () => {
                neighbour.emit("colorChanged", { color: "#ff0000" });
            });

            expect(seen.map((change) => change.color)).toEqual(["#ff0000"]);
        } finally {
            watcher.close();
            neighbour.close();
        }
    });

    it("does not send a name change from someone across the world", async () => {
        const watcher = await joinAt(0);
        const distant = await joinAt(6000);

        try {
            const seen = await collect(watcher, "newCarUpdate", () => {
                distant.emit("carUpdate", { name: "far away", color: "#00ff00" });
            });

            expect(seen).toEqual([]);
        } finally {
            watcher.close();
            distant.close();
        }
    });

    it("sends a name change from someone nearby", async () => {
        const watcher = await joinAt(0);
        const neighbour = await joinAt(200);

        try {
            const seen = await collect(watcher, "newCarUpdate", () => {
                neighbour.emit("carUpdate", { name: "next door", color: "#00ff00" });
            });

            expect(seen.map((change) => change.name)).toEqual(["next door"]);
        } finally {
            watcher.close();
            neighbour.close();
        }
    });

    // A car is described from what the server remembers of it, which was
    // whatever it looked like when it joined. Repaint it out of sight and drive
    // over, and you arrived in the old colour: the change had been broadcast to
    // people who had never heard of your car and discarded it, and the
    // description they were finally given still said blue.
    it("describes a car by its current colour when it comes into view", async () => {
        const watcher = await joinAt(0);
        const arriving = await joinAt(1400);

        try {
            arriving.emit("colorChanged", { color: "#123456" });
            await new Promise((r) => setTimeout(r, 100));

            const seen = [];
            watcher.on("newCarJoined", (payload) => seen.push(payload));
            await driveTo(arriving, 1400, 700);
            watcher.off("newCarJoined");

            expect(seen.length).toBeGreaterThan(0);
            expect(seen.at(-1).color).toBe("#123456");
        } finally {
            watcher.close();
            arriving.close();
        }
    });

    it("describes a car by its current name when it comes into view", async () => {
        const watcher = await joinAt(0);
        const arriving = await joinAt(1400);

        try {
            arriving.emit("carUpdate", { name: "renamed", color: "#654321" });
            await new Promise((r) => setTimeout(r, 100));

            const seen = [];
            watcher.on("newCarJoined", (payload) => seen.push(payload));
            await driveTo(arriving, 1400, 700);
            watcher.off("newCarJoined");

            expect(seen.length).toBeGreaterThan(0);
            expect(seen.at(-1).name).toBe("renamed");
        } finally {
            watcher.close();
            arriving.close();
        }
    });

    // Without this the car simply never appears: a client is told about people
    // present when it joined and nobody who arrives later.
    it("announces someone who drives into view", async () => {
        const watcher = await joinAt(0);
        const arriving = await joinAt(1400);

        try {
            const seen = [];
            watcher.on("newCarJoined", (payload) => seen.push(payload));
            await driveTo(arriving, 1400, 700);
            watcher.off("newCarJoined");

            expect(seen.map((car) => car.id)).toContain(arriving.id);
        } finally {
            watcher.close();
            arriving.close();
        }
    });

    // And without this it freezes: the last position received stays on screen
    // forever, a ghost parked where someone used to be.
    it("removes someone who drives out of view", async () => {
        const watcher = await joinAt(0);
        const leaving = await joinAt(700);

        try {
            const seen = [];
            watcher.on("carLeft", (payload) => seen.push(payload));
            await driveTo(leaving, 700, 1400);
            watcher.off("carLeft");

            expect(seen.map((car) => car.id)).toContain(leaving.id);
        } finally {
            watcher.close();
            leaving.close();
        }
    });
});

// Join-a-friend cannot be a client-side jump: Phase 4 made the server hold the
// position and refuse anything it could not have driven to, so a teleport is
// exactly what it rejects. The move therefore happens on the server, which is
// also the only place that can put the player in the grid at the same time.
describe("joining a friend", () => {
    async function loggedInSocket() {
        const user = await registerUser();
        const agent = request.agent(app);
        const login = await agent
            .post("/login")
            .set("X-Forwarded-For", uniqueIp())
            .send({ email: user.email, password: user.password });
        const cookie = login.headers["set-cookie"].map((c) => c.split(";")[0]).join("; ");
        const socket = await connect({ Cookie: cookie });
        return { user, agent, socket };
    }

    async function befriend(a, b) {
        await a.agent.post("/friends").send({ username: b.user.username });
        const friendship = await db.friendships.findOne({});
        await b.agent.patch(`/friends/${friendship._id}`).send({ accept: true });
        return friendship._id.toString();
    }

    async function enterWorldAt(socket, worldX) {
        socket.emit("carJoined", {
            coords: { x: 0, y: 600 },
            color: "#fff",
            name: "p",
            screen: worldX,
        });
        await new Promise((r) => setTimeout(r, 150));
    }

    it("moves the joiner next to their friend", async () => {
        const me = await loggedInSocket();
        const friend = await loggedInSocket();
        const friendshipId = await befriend(me, friend);
        await enterWorldAt(me.socket, 0);
        await enterWorldAt(friend.socket, 5000);

        try {
            const moved = await new Promise((resolve) => {
                me.socket.on("positionCorrection", resolve);
                me.socket.emit("joinFriend", { friendshipId });
            });

            expect(moved.x).toBeGreaterThan(4800);
            expect(moved.x).toBeLessThan(5200);
        } finally {
            me.socket.close();
            friend.socket.close();
        }
    });

    // Being moved there is the whole point — a client that arrives without the
    // server agreeing would have every subsequent step refused.
    it("leaves the joiner able to keep driving from there", async () => {
        const me = await loggedInSocket();
        const friend = await loggedInSocket();
        const friendshipId = await befriend(me, friend);
        await enterWorldAt(me.socket, 0);
        await enterWorldAt(friend.socket, 5000);

        try {
            await new Promise((resolve) => {
                me.socket.on("positionCorrection", resolve);
                me.socket.emit("joinFriend", { friendshipId });
            });

            // A step they could have driven, from where the server just put
            // them. The arrival is beside the friend, not on top of them.
            await new Promise((r) => setTimeout(r, 200));
            const refusals = await collect(me.socket, "positionCorrection", () => {
                me.socket.emit("carPosition", { coords: { x: 0, y: 600 }, screen: 4970 });
            });

            expect(refusals).toEqual([]);
        } finally {
            me.socket.close();
            friend.socket.close();
        }
    });

    it("refuses when the friendship is only pending", async () => {
        const me = await loggedInSocket();
        const other = await loggedInSocket();
        await me.agent.post("/friends").send({ username: other.user.username });
        const friendship = await db.friendships.findOne({});
        await enterWorldAt(me.socket, 0);
        await enterWorldAt(other.socket, 5000);

        try {
            const moved = await collect(me.socket, "positionCorrection", () => {
                me.socket.emit("joinFriend", { friendshipId: friendship._id.toString() });
            });

            expect(moved).toEqual([]);
        } finally {
            me.socket.close();
            other.socket.close();
        }
    });

    it("refuses a friendship the joiner is not part of", async () => {
        const first = await loggedInSocket();
        const second = await loggedInSocket();
        const stranger = await loggedInSocket();
        const friendshipId = await befriend(first, second);
        await enterWorldAt(stranger.socket, 0);
        await enterWorldAt(second.socket, 5000);

        try {
            const moved = await collect(stranger.socket, "positionCorrection", () => {
                stranger.socket.emit("joinFriend", { friendshipId });
            });

            expect(moved).toEqual([]);
        } finally {
            first.socket.close();
            second.socket.close();
            stranger.socket.close();
        }
    });
});
