import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { io as ioClient } from "socket.io-client";
import request from "supertest";
import { server, app } from "../app.js";
import db from "../database/createConnection.js";
import { registerUser, seedTheater, uniqueIp } from "./helpers.js";

/**
 * `newTheaterAdded` tells every client to reload the strip.
 *
 * It is the most expensive signal the server sends: every connected client
 * answers it with a listing request. Sending it on every disconnect meant one
 * person closing a tab cost a request from everyone else — and a blip that drops
 * fifty connections costs fifty times that, at the moment the server can least
 * afford it.
 *
 * A disconnect is not what changes the strip. Occupancy is, and the strip should
 * hear about it from whatever changes it — which also fixes the other half:
 * walking out of a theater freed a seat and told nobody, so everyone else's
 * listing kept showing it as taken.
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

async function loggedInSocket() {
    const user = await registerUser();
    const agent = request.agent(app);
    const login = await agent
        .post("/login")
        .set("X-Forwarded-For", uniqueIp())
        .send({ email: user.email, password: user.password });
    expect(login.status).toBe(200);

    const cookie = login.headers["set-cookie"].map((c) => c.split(";")[0]).join("; ");
    const stored = await db.users.findOne({ email: user.email.toLowerCase() });
    return { socket: await connect({ Cookie: cookie }), agent, userID: stored._id.toString() };
}

/** Someone logged in, joined to `theater`, and connected to its room. */
async function occupant(theater) {
    const { socket, agent, userID } = await loggedInSocket();
    const join = await agent.patch(`/theaters/${theater._id}`).send({ joining: true, userID });
    expect(join.status).toBe(200);

    socket.emit("enteredTheater", { theaterId: theater._id.toString() });
    await new Promise((r) => setTimeout(r, 200));
    return socket;
}

async function collect(watcher, event, act, ms = 400) {
    const seen = [];
    watcher.on(event, () => seen.push(true));
    await act();
    await new Promise((r) => setTimeout(r, ms));
    watcher.off(event);
    return seen;
}

describe("telling everyone the strip has changed", () => {
    it("says nothing when someone who was never in a theater disconnects", async () => {
        const watcher = await loggedInSocket();
        const passerby = await loggedInSocket();

        try {
            const seen = await collect(watcher.socket, "newTheaterAdded", () => {
                passerby.socket.close();
            });

            expect(seen).toEqual([]);
        } finally {
            watcher.socket.close();
            passerby.socket.close();
        }
    });

    it("says so when someone inside a theater disconnects, freeing their seat", async () => {
        const theater = await seedTheater({ eventName: "Seat freed by a dropped tab" });
        const watcher = await loggedInSocket();
        const leaver = await occupant(theater);

        try {
            const seen = await collect(watcher.socket, "newTheaterAdded", () => {
                leaver.close();
            });

            expect(seen.length).toBeGreaterThan(0);
        } finally {
            watcher.socket.close();
            leaver.close();
        }
    });

    // The same seat, given back deliberately rather than by a dropped
    // connection. Previously only the dropped one was announced.
    it("says so when someone walks out of a theater", async () => {
        const theater = await seedTheater({ eventName: "Seat freed on the way out" });
        const watcher = await loggedInSocket();
        const leaver = await occupant(theater);

        try {
            const seen = await collect(watcher.socket, "newTheaterAdded", () => {
                leaver.emit("leftTheater");
            });

            expect(seen.length).toBeGreaterThan(0);
        } finally {
            watcher.socket.close();
            leaver.close();
        }
    });
});
