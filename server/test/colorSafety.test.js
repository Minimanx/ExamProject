import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { io as ioClient } from "socket.io-client";
import request from "supertest";
import { server, app } from "../app.js";
import db from "../database/createConnection.js";
import { safeColor, DEFAULT_COLOR } from "../world/colors.js";
import { registerUser, seedTheater, uniqueIp } from "./helpers.js";

/**
 * A colour arrives from a client and is shown to everyone else.
 *
 * The chat one is rendered into a style attribute, so a "colour" that is really
 * a run of CSS declarations is a black rectangle over every screen in the
 * theater — demonstrated in a browser before this was written, where it came out
 * as a fixed-position element the full width of the viewport.
 */
describe("what counts as a colour", () => {
    it("keeps a six-digit hex colour", () => {
        expect(safeColor("#ff8800")).toBe("#ff8800");
        expect(safeColor("#FF8800")).toBe("#FF8800");
    });

    // What the tests and the older clients send.
    it("keeps a three-digit hex colour", () => {
        expect(safeColor("#fff")).toBe("#fff");
    });

    it("replaces a run of css declarations", () => {
        expect(
            safeColor(
                "red; position: fixed; top: 0; width: 100vw; height: 100vh; background: black"
            )
        ).toBe(DEFAULT_COLOR);
    });

    // Quietly reports every viewer's address to whoever asked for it.
    it("replaces one that fetches something", () => {
        expect(safeColor("#fff; background: url(https://example.com/who-saw-this)")).toBe(
            DEFAULT_COLOR
        );
    });

    it("replaces a named colour, which is not what any client sends", () => {
        expect(safeColor("red")).toBe(DEFAULT_COLOR);
    });

    it("replaces anything that is not a string", () => {
        expect(safeColor(undefined)).toBe(DEFAULT_COLOR);
        expect(safeColor(null)).toBe(DEFAULT_COLOR);
        expect(safeColor({ toString: () => "#ffffff" })).toBe(DEFAULT_COLOR);
        expect(safeColor(["#ffffff"])).toBe(DEFAULT_COLOR);
    });

    // A hex colour with anything after it is not a hex colour.
    it("replaces a hex colour with a tail", () => {
        expect(safeColor("#ffffff;position:fixed")).toBe(DEFAULT_COLOR);
        expect(safeColor("#fffffff")).toBe(DEFAULT_COLOR);
    });
});

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

async function occupant(theater) {
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
    await new Promise((r) => setTimeout(r, 200));
    return socket;
}

/** A logged-in player standing in the hub, near enough to be seen. */
async function hubPlayer(worldX = 100) {
    const user = await registerUser();
    const agent = request.agent(app);
    const login = await agent
        .post("/login")
        .set("X-Forwarded-For", uniqueIp())
        .send({ email: user.email, password: user.password });
    expect(login.status).toBe(200);

    const cookie = login.headers["set-cookie"].map((c) => c.split(";")[0]).join("; ");
    const socket = await connect({ Cookie: cookie });

    await new Promise((resolve) => {
        socket.once("hubAssigned", resolve);
        socket.emit("carJoined", {
            coords: { x: 0, y: 600 },
            color: "#fff",
            name: user.username,
            screen: worldX,
        });
    });
    await new Promise((r) => setTimeout(r, 100));
    return socket;
}

const HOSTILE =
    "red; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: black";

describe("a colour on its way to everyone else", () => {
    it("does not carry a pile of css into a theater's chat", async () => {
        const theater = await seedTheater({ eventName: "Colour safety" });
        const listener = await occupant(theater);
        const speaker = await occupant(theater);

        try {
            const seen = [];
            listener.on("newMessage", (message) => seen.push(message));

            speaker.emit("sendNewMessage", { sendMessage: "hello", color: HOSTILE });
            await new Promise((r) => setTimeout(r, 400));

            const fromSpeaker = seen.filter((message) => message.text === "hello");
            expect(fromSpeaker).toHaveLength(1);
            expect(fromSpeaker[0].color).toBe(DEFAULT_COLOR);
        } finally {
            listener.close();
            speaker.close();
        }
    });

    // A car's colour is drawn as an svg stroke rather than into a style
    // attribute, so it is the less dangerous of the two — but it is the same
    // untrusted value going to the same people, and it is the description every
    // later announcement of that car is built from.
    it("does not carry a pile of css onto a car in the hub", async () => {
        const watcher = await hubPlayer();
        const painter = await hubPlayer();

        try {
            const seen = [];
            watcher.on("newColorChanged", (change) => seen.push(change));

            painter.emit("colorChanged", { color: HOSTILE });
            await new Promise((r) => setTimeout(r, 400));

            expect(seen).toHaveLength(1);
            expect(seen[0].color).toBe(DEFAULT_COLOR);
        } finally {
            watcher.close();
            painter.close();
        }
    });

    it("still carries an ordinary colour", async () => {
        const theater = await seedTheater({ eventName: "Ordinary colour" });
        const listener = await occupant(theater);
        const speaker = await occupant(theater);

        try {
            const seen = [];
            listener.on("newMessage", (message) => seen.push(message));

            speaker.emit("sendNewMessage", { sendMessage: "hello", color: "#ff8800" });
            await new Promise((r) => setTimeout(r, 400));

            expect(seen.find((message) => message.text === "hello").color).toBe("#ff8800");
        } finally {
            listener.close();
            speaker.close();
        }
    });
});
