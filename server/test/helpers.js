import bcrypt from "bcrypt";
import request from "supertest";
import { app } from "../app.js";
import db from "../database/createConnection.js";

let counter = 0;
let ipCounter = 0;

export function uniqueIp() {
    ipCounter += 1;
    return `10.0.${Math.floor(ipCounter / 256) % 256}.${ipCounter % 256}`;
}

export async function registerUser(overrides = {}) {
    counter += 1;
    const user = {
        username: `user${counter}`,
        email: `user${counter}@example.com`,
        password: "password123",
        ...overrides,
    };

    await db.users.insertOne({
        username: user.username,
        email: user.email.toLowerCase(),
        password: await bcrypt.hash(user.password, 4),
    });

    return user;
}

export async function loginAgent(user) {
    const agent = request.agent(app);
    const response = await agent
        .post("/login")
        .set("X-Forwarded-For", uniqueIp())
        .send({ email: user.email, password: user.password });

    if (response.status !== 200) {
        throw new Error(`loginAgent failed: ${response.status} ${JSON.stringify(response.body)}`);
    }

    return agent;
}

// ownerID and position both carry unique indexes — one live event per owner,
// one theater per slot — so fixtures that shared a default collided the moment
// a test seeded two of them. See defect C4.
let theaterCounter = 0;

export async function seedTheater(overrides = {}) {
    theaterCounter += 1;
    const theater = {
        eventName: "Movie Night",
        startTime: new Date(Date.now() + 3600000),
        timeToClose: new Date(Date.now() + 10800000),
        amountOfSpaces: 10,
        position: theaterCounter,
        ownerID: `${theaterCounter}`.padStart(24, "0"),
        usersInsideTheater: [],
        isPrivate: false,
        imdbID: "tt0000001",
        movieName: "Test Movie",
        movieRuntime: 120,
        ...overrides,
    };

    const result = await db.theaters.insertOne(theater);
    return { ...theater, _id: result.insertedId };
}

export function mockOmdb(fetchMock, payload) {
    fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => payload,
    });
}

/**
 * A logged-in user, their agent, and their id.
 *
 * Four test files had their own copy of this under two different names, which
 * is four places to update when the login flow changes.
 */
export async function loggedIn(overrides = {}) {
    const user = await registerUser(overrides);
    const agent = await loginAgent(user);
    const stored = await db.users.findOne({ email: user.email.toLowerCase() });
    return { agent, user, userID: stored._id.toString() };
}

/**
 * The cookie a socket needs to carry a real session.
 *
 * `loginAgent` keeps its cookies in a jar the socket cannot read, so a socket
 * test has to log in itself and take the header.
 */
export async function sessionCookieFor(user) {
    const login = await request(app)
        .post("/login")
        .set("X-Forwarded-For", uniqueIp())
        .send({ email: user.email, password: user.password });

    if (login.status !== 200) {
        throw new Error(`sessionCookieFor failed: ${login.status}`);
    }
    return login.headers["set-cookie"].map((cookie) => cookie.split(";")[0]).join("; ");
}
