import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { io as ioClient } from "socket.io-client";
import request from "supertest";
import { server, app } from "../app.js";
import { registerUser, uniqueIp } from "./helpers.js";
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
