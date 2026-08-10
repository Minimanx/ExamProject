import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { io as ioClient } from "socket.io-client";
import request from "supertest";
import { server, app } from "../app.js";
import { registerUser, seedTheater, uniqueIp } from "./helpers.js";
import db from "../database/createConnection.js";

let baseUrl;

beforeAll(async () => {
    await new Promise((resolve) => server.listen(0, resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
});

afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
});

/** A socket carrying a real logged-in session cookie. */
async function connectAsUser() {
    const user = await registerUser();
    const agent = request.agent(app);
    const login = await agent
        .post("/login")
        .set("X-Forwarded-For", uniqueIp())
        .send({ email: user.email, password: user.password });
    expect(login.status).toBe(200);

    const cookie = login.headers["set-cookie"].map((c) => c.split(";")[0]).join("; ");
    return connect({ Cookie: cookie });
}

function connect(extraHeaders = {}) {
    const socket = ioClient(baseUrl, {
        extraHeaders,
        transports: ["websocket", "polling"],
        reconnection: false,
    });
    return new Promise((resolve, reject) => {
        socket.on("connect", () => resolve(socket));
        socket.on("connect_error", reject);
        setTimeout(() => reject(new Error("socket did not connect")), 5000);
    });
}

/** Collect events seen by `watcher` for a moment after `act()` runs. */
async function collect(watcher, event, act, ms = 400) {
    const seen = [];
    watcher.on(event, (payload) => seen.push(payload));
    await act();
    await new Promise((r) => setTimeout(r, ms));
    watcher.off(event);
    return seen;
}

// DEFECT S4: none of the car handlers checked the session, so any anonymous
// socket could join the world and broadcast to every player.
describe("socket authentication (defect S4)", () => {
    it("ignores car events from a socket with no session", async () => {
        const watcher = await connectAsUser();
        const anonymous = await connect();
        try {
            const seen = await collect(watcher, "newCarJoined", () => {
                anonymous.emit("carJoined", {
                    coords: { x: 1, y: 2 },
                    color: "#fff",
                    name: "ghost",
                    screen: 0,
                });
            });
            expect(seen).toHaveLength(0);
        } finally {
            watcher.close();
            anonymous.close();
        }
    });

    it("relays car events from an authenticated socket", async () => {
        const watcher = await connectAsUser();
        const player = await connectAsUser();
        try {
            const seen = await collect(watcher, "newCarJoined", () => {
                player.emit("carJoined", {
                    coords: { x: 1, y: 2 },
                    color: "#fff",
                    name: "real",
                    screen: 0,
                });
            });
            expect(seen).toHaveLength(1);
        } finally {
            watcher.close();
            player.close();
        }
    });
});

// DEFECT S3: carPosition and carJoined echoed a client-supplied `id`, so a
// player could impersonate or teleport another player's car.
describe("socket identity (defect S3)", () => {
    it("uses the connection's own id, not one supplied by the client", async () => {
        const watcher = await connectAsUser();
        const player = await connectAsUser();
        try {
            const seen = await collect(watcher, "newCarPosition", () => {
                player.emit("carPosition", {
                    id: "somebody-elses-socket-id",
                    coords: { x: 9, y: 9 },
                    direction: false,
                    screen: 0,
                });
            });
            expect(seen).toHaveLength(1);
            expect(seen[0].id).toBe(player.id);
            expect(seen[0].id).not.toBe("somebody-elses-socket-id");
        } finally {
            watcher.close();
            player.close();
        }
    });
});

// DEFECT S7: the only limit on a chat message was the client's maxlength
// attribute. Nothing server-side checked length, type or rate, so a crafted
// client could flood every occupant of a theater with arbitrary payloads.
//
// These tests must be INSIDE a theater room to mean anything: outside one the
// room check rejects everything and they would pass with no validation at all.
describe("chat message validation (defect S7)", () => {
    /** Register, log in, join `theater` over HTTP, then open a socket in its room. */
    async function connectInsideTheater(theater) {
        const user = await registerUser();
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

    it("relays an ordinary message, proving the room is live", async () => {
        const theater = await seedTheater();
        const watcher = await connectInsideTheater(theater);
        const sender = await connectInsideTheater(theater);
        try {
            const seen = await collect(watcher, "newMessage", () => {
                sender.emit("sendNewMessage", { sendMessage: "hello", color: "#fff" });
            });
            expect(seen.some((m) => m.text === "hello")).toBe(true);
        } finally {
            watcher.close();
            sender.close();
        }
    });

    it("drops an over-long message", async () => {
        const theater = await seedTheater();
        const watcher = await connectInsideTheater(theater);
        const sender = await connectInsideTheater(theater);
        try {
            const seen = await collect(watcher, "newMessage", () => {
                sender.emit("sendNewMessage", { sendMessage: "x".repeat(5000), color: "#fff" });
            });
            expect(seen.some((m) => m.text?.length > 500)).toBe(false);
        } finally {
            watcher.close();
            sender.close();
        }
    });

    it("drops a non-string message", async () => {
        const theater = await seedTheater();
        const watcher = await connectInsideTheater(theater);
        const sender = await connectInsideTheater(theater);
        try {
            const seen = await collect(watcher, "newMessage", () => {
                sender.emit("sendNewMessage", { sendMessage: { $ne: null }, color: "#fff" });
            });
            expect(seen.some((m) => typeof m.text !== "string")).toBe(false);
        } finally {
            watcher.close();
            sender.close();
        }
    });

    it("drops messages sent faster than the rate limit", async () => {
        const theater = await seedTheater();
        const watcher = await connectInsideTheater(theater);
        const sender = await connectInsideTheater(theater);
        try {
            const seen = await collect(
                watcher,
                "newMessage",
                () => {
                    for (let i = 0; i < 30; i++) {
                        sender.emit("sendNewMessage", { sendMessage: `flood ${i}`, color: "#fff" });
                    }
                },
                700
            );
            const flood = seen.filter((m) => m.text?.startsWith("flood"));
            expect(flood.length).toBeGreaterThan(0);
            expect(flood.length).toBeLessThan(30);
        } finally {
            watcher.close();
            sender.close();
        }
    });
});
