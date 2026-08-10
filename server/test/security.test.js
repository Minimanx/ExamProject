import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../app.js";
import { registerUser, seedTheater, uniqueIp } from "./helpers.js";

describe("security headers (defect S6)", () => {
    it("sets the headers helmet provides", async () => {
        const response = await request(app).get("/health");

        expect(response.headers["x-content-type-options"]).toBe("nosniff");
        expect(response.headers["x-frame-options"]).toBeDefined();
        expect(response.headers["x-dns-prefetch-control"]).toBeDefined();
    });

    it("does not advertise the framework", async () => {
        const response = await request(app).get("/health");

        expect(response.headers["x-powered-by"]).toBeUndefined();
    });
});

// DEFECT S5: production runs sameSite:"none" with credentials:"include", so the
// session cookie rides along on cross-site requests. Without a check, any page
// could drive a state-changing request as the logged-in user. The client and API
// are on different origins, so SameSite cannot be tightened; the origin of
// state-changing requests is validated instead.
describe("cross-site request forgery (defect S5)", () => {
    it("rejects a state-changing request from an unlisted origin", async () => {
        const response = await request(app)
            .post("/login")
            .set("Origin", "https://evil.example.com")
            .set("X-Forwarded-For", uniqueIp())
            .send({ email: "someone@example.com", password: "password123" });

        expect(response.status).toBe(403);
        expect(response.body.message).toBe("Cross-origin request rejected");
    });

    it("allows a state-changing request from an allowed origin", async () => {
        const user = await registerUser();

        const response = await request(app)
            .post("/login")
            .set("Origin", "http://localhost:8080")
            .set("X-Forwarded-For", uniqueIp())
            .send({ email: user.email, password: user.password });

        expect(response.status).toBe(200);
    });

    it("allows a request with no Origin header at all", async () => {
        // Same-origin form posts and non-browser clients omit it; only a
        // present-and-wrong origin is evidence of a cross-site attempt.
        const response = await request(app).get("/health");

        expect(response.status).toBe(200);
    });

    it("does not gate safe methods", async () => {
        const response = await request(app)
            .get("/theaters")
            .set("Origin", "https://evil.example.com");

        expect(response.status).toBe(200);
    });
});

// DEFECT S8: the listing is public by design — you can browse events before
// signing up — but it exposed ownerID, which nothing in the client needs.
describe("theater listing does not leak owner ids (defect S8)", () => {
    it("omits ownerID and password from every theater", async () => {
        await seedTheater({ eventName: "Public Night" });

        const response = await request(app).get("/theaters");

        expect(response.status).toBe(200);
        expect(response.body.data).toHaveLength(1);
        expect(response.body.data[0].eventName).toBe("Public Night");
        expect(response.body.data[0].ownerID).toBeUndefined();
        expect(response.body.data[0].password).toBeUndefined();
    });
});
