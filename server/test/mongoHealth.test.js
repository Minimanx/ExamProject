import { describe, it, expect } from "vitest";
import { checkMongoHealth, MONGO_PING_TIMEOUT_MS } from "../health.js";

// DEFECT O4 (roadmap spec §5), remaining half: /health answered 200 whenever
// the process was alive, including while Mongo was unreachable. Every route
// touches Mongo and sessions are stored there, so an instance without it can
// serve nothing — but a load balancer had no way to know.
//
// The check is a unit rather than an integration test because the interesting
// cases are Mongo being gone and Mongo hanging, and mongodb-memory-server is up
// for the whole run. A fake client reaches both.
describe("checkMongoHealth", () => {
    const clientThatPings = (ping) => ({ db: () => ({ admin: () => ({ ping }) }) });

    it("reports healthy when the ping succeeds", async () => {
        const client = clientThatPings(async () => ({ ok: 1 }));

        expect(await checkMongoHealth(client)).toBe(true);
    });

    it("reports unhealthy when the ping rejects", async () => {
        const client = clientThatPings(async () => {
            throw new Error("connection refused");
        });

        expect(await checkMongoHealth(client)).toBe(false);
    });

    it("reports unhealthy when the ping throws synchronously", async () => {
        const client = clientThatPings(() => {
            throw new Error("pool destroyed");
        });

        expect(await checkMongoHealth(client)).toBe(false);
    });

    // The driver's own serverSelectionTimeoutMS defaults to 30 seconds, which
    // is far longer than any load balancer waits. A hung Mongo has to read as
    // unhealthy quickly, not tie up the health check until the balancer gives
    // up and decides for itself.
    it("gives up on a ping that never settles", async () => {
        const client = clientThatPings(() => new Promise(() => {}));

        const startedAt = Date.now();
        const healthy = await checkMongoHealth(client, 25);

        expect(healthy).toBe(false);
        expect(Date.now() - startedAt).toBeLessThan(MONGO_PING_TIMEOUT_MS);
    });
});
