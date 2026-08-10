import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../app.js";
import db from "../database/createConnection.js";
import { seedTheater } from "./helpers.js";

// DEFECT O1: no collection had an index, so every signup ran two full
// collection scans — one of them a collation query on username.
describe("database indexes (defect O1)", () => {
    it("indexes the fields every request looks users up by", async () => {
        const names = (await db.users.indexes()).map((i) => i.name);

        expect(names.some((n) => n.includes("email"))).toBe(true);
        expect(names.some((n) => n.includes("username"))).toBe(true);
    });

    it("indexes the theater fields used for listing and slot allocation", async () => {
        const names = (await db.theaters.indexes()).map((i) => i.name);

        expect(names.some((n) => n.includes("position"))).toBe(true);
        expect(names.some((n) => n.includes("ownerID"))).toBe(true);
    });

    it("enforces uniqueness on email at the database, not just in application code", async () => {
        await db.users.insertOne({ email: "dupe@example.com", username: "dupe1", password: "x" });

        await expect(
            db.users.insertOne({ email: "dupe@example.com", username: "dupe2", password: "x" })
        ).rejects.toThrow();
    });
});

// DEFECT C6: timeToClose was written when a theater was created and never read
// again, so closed theaters accumulated forever, holding their slot on the strip.
describe("expired theater cleanup (defect C6)", () => {
    it("omits theaters whose closing time has passed", async () => {
        await seedTheater({ eventName: "Still Open", timeToClose: new Date(Date.now() + 3600000) });
        await seedTheater({
            eventName: "Long Closed",
            timeToClose: new Date(Date.now() - 3600000),
        });

        const response = await request(app).get("/theaters");
        const names = response.body.data.map((t) => t.eventName);

        expect(names).toContain("Still Open");
        expect(names).not.toContain("Long Closed");
    });

    it("removes expired theaters from the collection rather than only hiding them", async () => {
        await seedTheater({
            eventName: "Long Closed",
            timeToClose: new Date(Date.now() - 3600000),
        });

        await request(app).get("/theaters");

        expect(await db.theaters.countDocuments({ eventName: "Long Closed" })).toBe(0);
    });

    it("frees the owner to create another event once theirs has closed", async () => {
        await seedTheater({
            eventName: "Long Closed",
            ownerID: "000000000000000000000042",
            timeToClose: new Date(Date.now() - 3600000),
        });

        await request(app).get("/theaters");

        const stillOwned = await db.theaters.findOne({ ownerID: "000000000000000000000042" });
        expect(stillOwned).toBeNull();
    });
});
