import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { io as ioClient } from "socket.io-client";
import request from "supertest";
import { server, app } from "../app.js";
import db from "../database/createConnection.js";
import { registerUser, seedTheater, uniqueIp } from "./helpers.js";
import { resetPlaybackState, trackedTheaterCount } from "../socketios/playbackSocket.js";

// Phase 3 exit criterion: two people watch a film with synchronized play/pause.
//
// No video passes through the server. Each viewer opens their own copy from
// their own disk; what travels is a description of where the film should be, and
// each player is steered to match. The server never learns anything about the
// film beyond a number of seconds.
//
// The host owns that state. Hiding the controls from everyone else is a UI
// decision that an honest client respects and a modified one ignores, so the
// rule has to hold here.
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

/**
 * Register, log in, join `theater` over HTTP, then open a socket in its room.
 *
 * One login, and its cookie is used for both the join and the socket. Logging in
 * twice produces two sessions, and only the one that joined has
 * `session.theater` — so the socket would sit outside the room it appears to be
 * in, and every host action would be silently ignored.
 */
async function joinTheater(theater, existingUser) {
    const user = existingUser ?? (await registerUser());
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
    return { socket, userID: stored._id.toString() };
}

/** A theater whose owner is a real registered user, so a host can be identified. */
async function seedTheaterWithHost() {
    const host = await registerUser();
    const stored = await db.users.findOne({ email: host.email.toLowerCase() });
    const theater = await seedTheater({ ownerID: stored._id.toString(), amountOfSpaces: 10 });
    return { theater, host };
}

async function nextState(socket, act, ms = 400) {
    const seen = [];
    socket.on("playbackState", (payload) => seen.push(payload));
    await act();
    await new Promise((r) => setTimeout(r, ms));
    socket.off("playbackState");
    return seen;
}

describe("synced playback", () => {
    it("tells the room when the host presses play", async () => {
        const { theater, host } = await seedTheaterWithHost();
        const hostSide = await joinTheater(theater, host);
        const guest = await joinTheater(theater);

        try {
            const seen = await nextState(guest.socket, () => {
                hostSide.socket.emit("playbackPlay", { positionSeconds: 12.5 });
            });

            expect(seen.at(-1)).toMatchObject({ playing: true, positionSeconds: 12.5 });
        } finally {
            hostSide.socket.close();
            guest.socket.close();
        }
    });

    it("tells the room when the host pauses", async () => {
        const { theater, host } = await seedTheaterWithHost();
        const hostSide = await joinTheater(theater, host);
        const guest = await joinTheater(theater);

        try {
            hostSide.socket.emit("playbackPlay", { positionSeconds: 0 });
            const seen = await nextState(guest.socket, () => {
                hostSide.socket.emit("playbackPause", { positionSeconds: 30 });
            });

            expect(seen.at(-1)).toMatchObject({ playing: false, positionSeconds: 30 });
        } finally {
            hostSide.socket.close();
            guest.socket.close();
        }
    });

    // Every host action checks ownership against the database first, so two
    // sent in quick succession can finish their lookups out of order and be
    // applied in the wrong order. A host who pauses right after playing would
    // end up playing. Caught as a 1-in-6 flake on the pause test above; this
    // reproduces it on demand.
    it("applies rapid host actions in the order they were sent", async () => {
        const { theater, host } = await seedTheaterWithHost();
        const hostSide = await joinTheater(theater, host);
        const guest = await joinTheater(theater);

        try {
            const seen = await nextState(guest.socket, () => {
                hostSide.socket.emit("playbackPlay", { positionSeconds: 10 });
                hostSide.socket.emit("playbackPause", { positionSeconds: 20 });
                hostSide.socket.emit("playbackPlay", { positionSeconds: 30 });
                hostSide.socket.emit("playbackPause", { positionSeconds: 40 });
            });

            expect(seen.at(-1)).toMatchObject({ playing: false, positionSeconds: 40 });
        } finally {
            hostSide.socket.close();
            guest.socket.close();
        }
    });

    it("tells the room when the host seeks", async () => {
        const { theater, host } = await seedTheaterWithHost();
        const hostSide = await joinTheater(theater, host);
        const guest = await joinTheater(theater);

        try {
            const seen = await nextState(guest.socket, () => {
                hostSide.socket.emit("playbackSeek", { positionSeconds: 600 });
            });

            expect(seen.at(-1).positionSeconds).toBe(600);
        } finally {
            hostSide.socket.close();
            guest.socket.close();
        }
    });

    // The whole point of enforcing it here: the controls are merely hidden from
    // a guest, which stops an honest client and nothing else.
    it("ignores a guest trying to drive playback", async () => {
        const { theater, host } = await seedTheaterWithHost();
        const hostSide = await joinTheater(theater, host);
        const guest = await joinTheater(theater);

        try {
            const seen = await nextState(hostSide.socket, () => {
                guest.socket.emit("playbackPlay", { positionSeconds: 999 });
                guest.socket.emit("playbackSeek", { positionSeconds: 999 });
                guest.socket.emit("playbackPause", {});
            });

            expect(seen).toEqual([]);
        } finally {
            hostSide.socket.close();
            guest.socket.close();
        }
    });

    it("ignores a host who is not inside the theater", async () => {
        const { theater, host } = await seedTheaterWithHost();
        const guest = await joinTheater(theater);

        // Logged in as the host, but never joined the theater, so never in its
        // room. Owning an event is not the same as being at it.
        const login = await request(app)
            .post("/login")
            .set("X-Forwarded-For", uniqueIp())
            .send({ email: host.email, password: host.password });
        const cookie = login.headers["set-cookie"].map((c) => c.split(";")[0]).join("; ");
        const outside = await connect({ Cookie: cookie });

        try {
            const seen = await nextState(guest.socket, () => {
                outside.emit("playbackPlay", { positionSeconds: 5 });
            });

            expect(seen).toEqual([]);
        } finally {
            outside.close();
            guest.socket.close();
        }
    });

    // Someone arriving half an hour in should land where the film is, not at the
    // beginning.
    it("gives a late arrival the current position", async () => {
        const { theater, host } = await seedTheaterWithHost();
        const hostSide = await joinTheater(theater, host);

        try {
            hostSide.socket.emit("playbackPlay", { positionSeconds: 1800 });
            await new Promise((r) => setTimeout(r, 200));

            const late = await joinTheater(theater);
            try {
                const seen = await nextState(late.socket, () => {
                    late.socket.emit("playbackSync");
                });

                expect(seen.at(-1)).toMatchObject({ playing: true, positionSeconds: 1800 });
            } finally {
                late.socket.close();
            }
        } finally {
            hostSide.socket.close();
        }
    });

    it.each([["nonsense"], [null], [-5], [Infinity], [NaN]])(
        "ignores %s as a position",
        async (positionSeconds) => {
            const { theater, host } = await seedTheaterWithHost();
            const hostSide = await joinTheater(theater, host);

            try {
                hostSide.socket.emit("playbackSeek", { positionSeconds: 42 });
                await new Promise((r) => setTimeout(r, 150));

                const seen = await nextState(hostSide.socket, () => {
                    hostSide.socket.emit("playbackSeek", { positionSeconds });
                });

                expect(seen.at(-1)?.positionSeconds ?? 42).toBe(42);
            } finally {
                hostSide.socket.close();
            }
        }
    );
});

describe("ready check", () => {
    it("collects who has answered", async () => {
        const { theater, host } = await seedTheaterWithHost();
        const hostSide = await joinTheater(theater, host);
        const guest = await joinTheater(theater);

        try {
            hostSide.socket.emit("readyCheck");
            await new Promise((r) => setTimeout(r, 150));

            const seen = await nextState(hostSide.socket, () => {
                guest.socket.emit("ready");
            });

            expect(seen.at(-1).ready).toContain(guest.userID);
        } finally {
            hostSide.socket.close();
            guest.socket.close();
        }
    });

    it("counts one person once, however many times they answer", async () => {
        const { theater, host } = await seedTheaterWithHost();
        const hostSide = await joinTheater(theater, host);
        const guest = await joinTheater(theater);

        try {
            hostSide.socket.emit("readyCheck");
            await new Promise((r) => setTimeout(r, 150));

            const seen = await nextState(hostSide.socket, () => {
                guest.socket.emit("ready");
                guest.socket.emit("ready");
                guest.socket.emit("ready");
            });

            expect(seen.at(-1).ready).toEqual([guest.userID]);
        } finally {
            hostSide.socket.close();
            guest.socket.close();
        }
    });

    // Carrying old answers into a new check would show the host a room that is
    // ready when nobody has actually answered the question being asked.
    it("clears previous answers when the host asks again", async () => {
        const { theater, host } = await seedTheaterWithHost();
        const hostSide = await joinTheater(theater, host);
        const guest = await joinTheater(theater);

        try {
            hostSide.socket.emit("readyCheck");
            await new Promise((r) => setTimeout(r, 150));
            guest.socket.emit("ready");
            await new Promise((r) => setTimeout(r, 150));

            const seen = await nextState(hostSide.socket, () => {
                hostSide.socket.emit("readyCheck");
            });

            expect(seen.at(-1).ready).toEqual([]);
        } finally {
            hostSide.socket.close();
            guest.socket.close();
        }
    });

    it("ignores an answer when no check is open", async () => {
        const { theater, host } = await seedTheaterWithHost();
        const hostSide = await joinTheater(theater, host);
        const guest = await joinTheater(theater);

        try {
            const seen = await nextState(hostSide.socket, () => {
                guest.socket.emit("ready");
            });

            expect(seen).toEqual([]);
        } finally {
            hostSide.socket.close();
            guest.socket.close();
        }
    });

    it("only lets the host ask", async () => {
        const { theater, host } = await seedTheaterWithHost();
        const hostSide = await joinTheater(theater, host);
        const guest = await joinTheater(theater);

        try {
            const seen = await nextState(hostSide.socket, () => {
                guest.socket.emit("readyCheck");
            });

            expect(seen).toEqual([]);
        } finally {
            hostSide.socket.close();
            guest.socket.close();
        }
    });
});

describe("countdown", () => {
    it("reaches everyone in the room so nobody waits on a round trip", async () => {
        const { theater, host } = await seedTheaterWithHost();
        const hostSide = await joinTheater(theater, host);
        const guest = await joinTheater(theater);

        try {
            const seen = [];
            guest.socket.on("playbackCountdown", (payload) => seen.push(payload));
            hostSide.socket.emit("startCountdown");
            await new Promise((r) => setTimeout(r, 400));

            expect(seen).toHaveLength(1);
            expect(seen[0].seconds).toBeGreaterThan(0);
        } finally {
            hostSide.socket.close();
            guest.socket.close();
        }
    });

    it("only lets the host start one", async () => {
        const { theater, host } = await seedTheaterWithHost();
        const hostSide = await joinTheater(theater, host);
        const guest = await joinTheater(theater);

        try {
            const seen = [];
            hostSide.socket.on("playbackCountdown", (payload) => seen.push(payload));
            guest.socket.emit("startCountdown");
            await new Promise((r) => setTimeout(r, 400));

            expect(seen).toEqual([]);
        } finally {
            hostSide.socket.close();
            guest.socket.close();
        }
    });
});

// Playback state lives in memory, keyed by theater, and theaters are created and
// swept continuously. Nothing removed an entry when a showing ended, so a server
// that has been up for a week holds state for every theater that ever existed on
// it — small objects, but an unbounded number of them.
describe("playback state does not accumulate", () => {
    it("forgets a theater once the last person leaves it", async () => {
        const { theater, host } = await seedTheaterWithHost();
        const hostSide = await joinTheater(theater, host);

        hostSide.socket.emit("playbackPlay", { positionSeconds: 30 });
        await new Promise((r) => setTimeout(r, 300));
        expect(trackedTheaterCount()).toBe(1);

        hostSide.socket.close();
        await new Promise((r) => setTimeout(r, 500));

        expect(trackedTheaterCount()).toBe(0);
    });

    it("keeps the state while anyone is still watching", async () => {
        const { theater, host } = await seedTheaterWithHost();
        const hostSide = await joinTheater(theater, host);
        const guest = await joinTheater(theater);

        try {
            hostSide.socket.emit("playbackPlay", { positionSeconds: 30 });
            await new Promise((r) => setTimeout(r, 300));

            hostSide.socket.close();
            await new Promise((r) => setTimeout(r, 500));

            // The host stepping out must not reset the film for everyone else.
            expect(trackedTheaterCount()).toBe(1);
        } finally {
            guest.socket.close();
        }
    });
});
