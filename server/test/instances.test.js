import { describe, it, expect } from "vitest";
import { HubInstances } from "../world/instances.js";

// Phase 4's stated purpose is that Phase 11 — sharding the hub — becomes
// configuration rather than a rewrite. Only one instance will exist for a long
// time, so everything here has to be a no-op at that scale; the point is that
// the seam exists and is exercised, not that it carries load today.
describe("HubInstances", () => {
    it("puts the first player in an instance", () => {
        const hub = new HubInstances({ capacity: 60 });

        expect(hub.join("socket-a")).toEqual({ instanceId: "hub-0" });
    });

    it("puts everyone in the same instance while there is room", () => {
        const hub = new HubInstances({ capacity: 60 });

        const joined = ["a", "b", "c"].map((id) => hub.join(id).instanceId);

        expect(new Set(joined).size).toBe(1);
    });

    it("reports how many are in an instance", () => {
        const hub = new HubInstances({ capacity: 60 });
        hub.join("a");
        hub.join("b");

        expect(hub.occupancy("hub-0")).toBe(2);
    });

    // With one instance configured, full is simply full. Phase 11 replaces this
    // answer with "allocate another", which is the whole reason the caller has
    // to handle a refusal now rather than assuming a join always works.
    it("refuses a join once the instance is full", () => {
        const hub = new HubInstances({ capacity: 2 });
        hub.join("a");
        hub.join("b");

        expect(hub.join("c")).toEqual({ instanceId: null, reason: "The world is full" });
    });

    it("frees the place when someone leaves", () => {
        const hub = new HubInstances({ capacity: 2 });
        hub.join("a");
        hub.join("b");

        hub.leave("a");

        expect(hub.join("c").instanceId).toBe("hub-0");
    });

    // Joining twice is the ordinary consequence of a reconnect racing a
    // disconnect. Counting it twice would slowly fill the world with people who
    // are not there.
    it("counts one socket once, however often it joins", () => {
        const hub = new HubInstances({ capacity: 2 });

        hub.join("a");
        hub.join("a");
        hub.join("a");

        expect(hub.occupancy("hub-0")).toBe(1);
    });

    it("is untroubled by a socket leaving twice", () => {
        const hub = new HubInstances({ capacity: 2 });
        hub.join("a");

        hub.leave("a");
        hub.leave("a");

        expect(hub.occupancy("hub-0")).toBe(0);
    });

    it("is untroubled by a socket that never joined leaving", () => {
        const hub = new HubInstances({ capacity: 2 });

        expect(() => hub.leave("never-here")).not.toThrow();
    });

    it("says which instance a socket is in", () => {
        const hub = new HubInstances({ capacity: 60 });
        hub.join("a");

        expect(hub.instanceOf("a")).toBe("hub-0");
        expect(hub.instanceOf("b")).toBeNull();
    });

    it("forgets which instance a socket was in once it leaves", () => {
        const hub = new HubInstances({ capacity: 60 });
        hub.join("a");

        hub.leave("a");

        expect(hub.instanceOf("a")).toBeNull();
    });
});
