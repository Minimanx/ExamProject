import { describe, it, expect } from "vitest";
import { sessionSurvives } from "./session.js";

const answering = (init) => async () => new Response(init.body ?? "{}", init);

describe("whether signing in survived the round trip", () => {
    it("says yes when the server recognises us", async () => {
        expect(await sessionSurvives(answering({ status: 200 }))).toBe("yes");
    });

    // The cookie was not kept, so the server has no idea who this is — which is
    // what every later request would have discovered, one at a time.
    it("says no when the server does not", async () => {
        expect(await sessionSurvives(answering({ status: 401 }))).toBe("no");
    });

    // Not evidence the session failed. Refusing to sign someone in over a blip
    // is worse than the problem it guards against.
    it("does not blame the session for a server error", async () => {
        expect(await sessionSurvives(answering({ status: 500 }))).toBe("unknown");
        expect(await sessionSurvives(answering({ status: 502 }))).toBe("unknown");
    });

    it("does not blame the session for a network failure", async () => {
        expect(await sessionSurvives(() => Promise.reject(new TypeError("Failed to fetch")))).toBe(
            "unknown"
        );
    });
});
