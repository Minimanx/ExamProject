import { describe, it, expect } from "vitest";
import { readFile, readdir } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const serverRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

async function sourceFiles(directory = serverRoot) {
    const entries = await readdir(directory, { withFileTypes: true });
    const found = [];

    for (const entry of entries) {
        const full = path.join(directory, entry.name);
        if (entry.isDirectory()) {
            if (["node_modules", "test", ".git"].includes(entry.name)) continue;
            found.push(...(await sourceFiles(full)));
        } else if (entry.name.endsWith(".js")) {
            found.push(full);
        }
    }
    return found;
}

async function filesMentioning(token) {
    const files = await sourceFiles();
    const hits = [];

    for (const file of files) {
        const contents = await readFile(file, "utf8");
        // Comments describe the rule; only real references count.
        const code = contents.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
        if (code.includes(token)) {
            hits.push(path.relative(serverRoot, file));
        }
    }
    return hits.sort();
}

// The roadmap's Phase 2 asks for a domain layer that is the single owner of
// `usersInsideTheater`. That is not a stylistic preference: the field was added
// by the HTTP join and removed by the socket's disconnect handler, and nothing
// owned the pair. Defect C5 — a restart orphaning every occupant of every
// theater — is what split ownership cost.
//
// This asserts the ownership rather than the layering, because ownership is the
// part that was actually broken.
describe("the theater service owns occupancy", () => {
    it("is the only place that names usersInsideTheater", async () => {
        expect(await filesMentioning("usersInsideTheater")).toEqual(["services/theaterService.js"]);
    });

    it("is the only place that queries the theaters collection", async () => {
        expect(await filesMentioning("db.theaters")).toEqual(["services/theaterService.js"]);
    });
});
