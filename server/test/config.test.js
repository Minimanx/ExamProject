import { describe, it, expect } from "vitest";
import { validateConfig } from "../config.js";

// DEFECT O4-adjacent: required settings were checked ad hoc across three files,
// so a missing one surfaced as an obscure failure at the first request that
// happened to need it rather than at boot.
describe("boot-time configuration validation", () => {
    const complete = {
        MONGODB_URI: "mongodb://localhost:27017/FlixDrive",
        SESSION_SECRET: "a".repeat(32),
        NODE_ENV: "test",
    };

    it("accepts a complete configuration", () => {
        expect(() => validateConfig(complete)).not.toThrow();
    });

    it("names every missing setting at once rather than the first", () => {
        try {
            validateConfig({ NODE_ENV: "test" });
            throw new Error("expected validateConfig to throw");
        } catch (error) {
            expect(error.message).toContain("MONGODB_URI");
            expect(error.message).toContain("SESSION_SECRET");
        }
    });

    it("rejects a session secret too short to be worth having", () => {
        expect(() => validateConfig({ ...complete, SESSION_SECRET: "short" })).toThrow(
            /SESSION_SECRET/
        );
    });

    it("requires CLIENT_ORIGINS in production but not in development", () => {
        expect(() => validateConfig({ ...complete, NODE_ENV: "production" })).toThrow(
            /CLIENT_ORIGINS/
        );
        expect(() => validateConfig({ ...complete, NODE_ENV: "development" })).not.toThrow();
    });

    it("warns rather than throws when an optional integration is unconfigured", () => {
        const { warnings } = validateConfig(complete);

        expect(warnings.join(" ")).toMatch(/OMDB_API_KEY/);
    });
});

// The SvelteKit migration deleted client/public, which the SERVE_CLIENT=true
// branch served. adapter-vercel emits no index.html at all, so the branch
// cannot be repointed — it was removed. Anyone still setting the variable is
// running a configuration that silently does nothing.
describe("SERVE_CLIENT", () => {
    const complete = {
        MONGODB_URI: "mongodb://localhost:27017/FlixDrive",
        SESSION_SECRET: "a".repeat(32),
        NODE_ENV: "test",
    };

    it("warns that the server no longer serves the client", () => {
        const { warnings } = validateConfig({ ...complete, SERVE_CLIENT: "true" });

        expect(warnings.join(" ")).toContain("SERVE_CLIENT");
    });

    it("says nothing when SERVE_CLIENT is unset", () => {
        const { warnings } = validateConfig(complete);

        expect(warnings.join(" ")).not.toContain("SERVE_CLIENT");
    });
});
