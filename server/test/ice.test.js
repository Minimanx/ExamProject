import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../app.js";
import { iceServers, turnConfigured } from "../world/ice.js";
import { limits } from "../limits.js";
import { loggedIn } from "./helpers.js";

describe("which ice servers to offer", () => {
    it("always offers stun, so most pairs can connect with no relay at all", () => {
        const servers = iceServers({});

        expect(servers).toHaveLength(1);
        expect(servers[0].urls[0]).toMatch(/^stun:/);
    });

    it("takes the stun servers it is given", () => {
        expect(
            iceServers({ STUN_URLS: "stun:a.example:3478, stun:b.example:3478" })[0].urls
        ).toEqual(["stun:a.example:3478", "stun:b.example:3478"]);
    });

    it("adds turn when it is fully configured", () => {
        const servers = iceServers({
            TURN_URL: "turn:relay.example:3478",
            TURN_USERNAME: "who",
            TURN_CREDENTIAL: "secret",
        });

        expect(servers).toHaveLength(2);
        expect(servers[1]).toEqual({
            urls: ["turn:relay.example:3478"],
            username: "who",
            credential: "secret",
        });
    });

    // A relay that will refuse every allocation fails later and less clearly
    // than one that was never offered.
    it("leaves turn out when its credentials are missing", () => {
        expect(iceServers({ TURN_URL: "turn:relay.example:3478" })).toHaveLength(1);
        expect(
            iceServers({ TURN_URL: "turn:relay.example:3478", TURN_USERNAME: "who" })
        ).toHaveLength(1);
        expect(turnConfigured({ TURN_URL: "turn:relay.example:3478" })).toBe(false);
    });
});

describe("GET /ice", () => {
    it("refuses someone who is not logged in", async () => {
        const response = await request(app).get("/ice");

        expect(response.status).toBe(401);
    });

    // TURN credentials are credentials, so this is behind a session rather
    // than built into the client bundle where every visitor would have them.
    it("hands a logged-in client its ice servers and the cap", async () => {
        const { agent } = await loggedIn();

        const response = await agent.get("/ice");

        expect(response.status).toBe(200);
        expect(response.body.data.iceServers[0].urls[0]).toMatch(/^stun:|^turn:/);
        expect(response.body.data.capacity).toBe(limits.voiceCapacity);
    });
});
