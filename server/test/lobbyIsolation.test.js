import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { io as ioClient } from "socket.io-client";
import request from "supertest";
import { server, app } from "../app.js";
import db from "../database/createConnection.js";
import { registerUser, seedTheater, uniqueIp } from "./helpers.js";
import { resetPlaybackState } from "../socketios/playbackSocket.js";

// Phase 4's first exit criterion: two lobbies run simultaneously in separate
// instances. Playback state and chat are already keyed per theater, so this is
// probably already true — which is exactly the kind of claim worth proving. An
// untested "obviously fine" is how a leak survives to launch.
let baseUrl;

beforeAll(async () => {
    await new Promise((resolve) => server.listen(0, resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
});

afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
});

beforeEach(() => {
    resetPlaybackState();
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

async function hostAndTheater(eventName) {
    const host = await registerUser();
    const stored = await db.users.findOne({ email: host.email.toLowerCase() });
    const theater = await seedTheater({
        eventName,
        ownerID: stored._id.toString(),
        amountOfSpaces: 10,
    });
    return { host, theater };
}

/** A socket inside `theater`, logged in as `user`, in that theater's room. */
async function enterTheater(theater, user) {
    const agent = request.agent(app);
    const login = await agent
        .post("/login")
        .set("X-Forwarded-For", uniqueIp())
        .send({ email: user.email, password: user.password });
    expect(login.status).toBe(200);

    const stored = await db.users.findOne({ email: user.email.toLowerCase() });
    const join = await agent
        .patch(`/theaters/${theater._id}`)
        .send({ joining: true, userID: stored._id.toString() });
    expect(join.status).toBe(200);

    const cookie = login.headers["set-cookie"].map((c) => c.split(";")[0]).join("; ");
    const socket = await connect({ Cookie: cookie });
    socket.emit("enteredTheater", { theaterId: theater._id.toString() });
    await new Promise((r) => setTimeout(r, 300));
    return socket;
}

async function collect(socket, event, act, ms = 400) {
    const seen = [];
    socket.on(event, (payload) => seen.push(payload));
    await act();
    await new Promise((r) => setTimeout(r, ms));
    socket.off(event);
    return seen;
}

describe("two lobbies running at once", () => {
    it("keeps one host's playback out of the other lobby", async () => {
        const first = await hostAndTheater("First Showing");
        const second = await hostAndTheater("Second Showing");
        const firstHost = await enterTheater(first.theater, first.host);
        const secondHost = await enterTheater(second.theater, second.host);

        try {
            const seen = await collect(secondHost, "playbackState", () => {
                firstHost.emit("playbackPlay", { positionSeconds: 120 });
            });

            expect(seen).toEqual([]);
        } finally {
            firstHost.close();
            secondHost.close();
        }
    });

    it("lets both play at once, each at its own position", async () => {
        const first = await hostAndTheater("First Showing");
        const second = await hostAndTheater("Second Showing");
        const firstHost = await enterTheater(first.theater, first.host);
        const secondHost = await enterTheater(second.theater, second.host);

        try {
            const firstStates = [];
            const secondStates = [];
            firstHost.on("playbackState", (payload) => firstStates.push(payload));
            secondHost.on("playbackState", (payload) => secondStates.push(payload));

            firstHost.emit("playbackPlay", { positionSeconds: 120 });
            secondHost.emit("playbackPlay", { positionSeconds: 3600 });
            await new Promise((r) => setTimeout(r, 400));

            expect(firstStates.at(-1)).toMatchObject({ playing: true, positionSeconds: 120 });
            expect(secondStates.at(-1)).toMatchObject({ playing: true, positionSeconds: 3600 });
        } finally {
            firstHost.close();
            secondHost.close();
        }
    });

    it("keeps chat in its own lobby", async () => {
        const first = await hostAndTheater("First Showing");
        const second = await hostAndTheater("Second Showing");
        const firstHost = await enterTheater(first.theater, first.host);
        const secondHost = await enterTheater(second.theater, second.host);

        try {
            const seen = await collect(secondHost, "newMessage", () => {
                firstHost.emit("sendNewMessage", { sendMessage: "only for us", color: "#fff" });
            });

            expect(seen.map((message) => message.text)).not.toContain("only for us");
        } finally {
            firstHost.close();
            secondHost.close();
        }
    });

    it("keeps a ready check in its own lobby", async () => {
        const first = await hostAndTheater("First Showing");
        const second = await hostAndTheater("Second Showing");
        const firstHost = await enterTheater(first.theater, first.host);
        const secondHost = await enterTheater(second.theater, second.host);

        try {
            const seen = await collect(secondHost, "playbackState", () => {
                firstHost.emit("readyCheck");
            });

            expect(seen).toEqual([]);
        } finally {
            firstHost.close();
            secondHost.close();
        }
    });

    it("keeps a countdown in its own lobby", async () => {
        const first = await hostAndTheater("First Showing");
        const second = await hostAndTheater("Second Showing");
        const firstHost = await enterTheater(first.theater, first.host);
        const secondHost = await enterTheater(second.theater, second.host);

        try {
            const seen = await collect(secondHost, "playbackCountdown", () => {
                firstHost.emit("startCountdown");
            });

            expect(seen).toEqual([]);
        } finally {
            firstHost.close();
            secondHost.close();
        }
    });

    // Hosting one lobby must not confer control of another. The host check reads
    // the theater a socket is actually in, so this should hold — and a leak here
    // would be the worst kind, since a host is exactly who has the buttons.
    it("does not let one lobby's host drive the other", async () => {
        const first = await hostAndTheater("First Showing");
        const second = await hostAndTheater("Second Showing");
        const firstHost = await enterTheater(first.theater, first.host);
        // The first host also walks into the second lobby, as a guest.
        const asGuest = await enterTheater(second.theater, first.host);
        const secondHost = await enterTheater(second.theater, second.host);

        try {
            const seen = await collect(secondHost, "playbackState", () => {
                asGuest.emit("playbackPlay", { positionSeconds: 999 });
            });

            expect(seen).toEqual([]);
        } finally {
            firstHost.close();
            asGuest.close();
            secondHost.close();
        }
    });
});
