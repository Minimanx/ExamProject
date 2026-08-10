import { describe, it, expect } from "vitest";
import request from "supertest";
import bcrypt from "bcrypt";
import { app } from "../app.js";
import db from "../database/createConnection.js";
import { registerUser, uniqueIp } from "./helpers.js";

// Every request in this file hits loginRouter, which is capped at 10 per
// 15 minutes per IP. Each call gets its own IP, and therefore its own bucket.
const post = (url) => request(app).post(url).set("X-Forwarded-For", uniqueIp());
const patch = (url) => request(app).patch(url).set("X-Forwarded-For", uniqueIp());

async function requestResetToken(user) {
    await post("/forgotpassword").send({ email: user.email });
    const stored = await db.users.findOne({ email: user.email.toLowerCase() });
    return stored.passwordToken;
}

describe("POST /forgotpassword", () => {
    it("rejects a missing email", async () => {
        const response = await post("/forgotpassword").send({});

        expect(response.status).toBe(400);
        expect(response.body.message).toBe("All fields must be filled");
    });

    it("rejects a malformed email", async () => {
        const response = await post("/forgotpassword")
            .send({ email: "not-an-email" });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe("Email must be valid");
    });

    it("does not reveal whether an unknown email exists", async () => {
        const response = await post("/forgotpassword")
            .send({ email: "nobody@example.com" });

        expect(response.status).toBe(200);
        expect(response.body.message).toBe(
            "If this email is tied to a user, an email has been sent to it."
        );
    });

    // DEFECT S2 (roadmap spec §5): loginRouter.js:60 generates only
    // crypto.randomBytes(3) — 6 hex characters — with no expiry and no
    // attempt cap. Phase 2 raises the entropy and adds a TTL.
    it("stores a 6-character hex token with no expiry field", async () => {
        const user = await registerUser();
        const token = await requestResetToken(user);

        expect(token).toMatch(/^[0-9a-f]{6}$/);

        const stored = await db.users.findOne({ email: user.email.toLowerCase() });
        expect(stored.passwordTokenExpiresAt).toBeUndefined();
    });
});

describe("POST /resetpassword", () => {
    it("rejects a missing token", async () => {
        const response = await post("/resetpassword")
            .send({ email: "someone@example.com" });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe("Code must be filled");
    });

    it("rejects an incorrect token", async () => {
        const user = await registerUser();
        await requestResetToken(user);

        const response = await post("/resetpassword")
            .send({ email: user.email, token: "aaaaaa" });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe("Code is invalid");
    });

    it("accepts the correct token", async () => {
        const user = await registerUser();
        const token = await requestResetToken(user);

        const response = await post("/resetpassword")
            .send({ email: user.email, token });

        expect(response.status).toBe(200);
    });
});

describe("PATCH /resetpassword", () => {
    it("rejects mismatched passwords", async () => {
        const user = await registerUser();
        const token = await requestResetToken(user);

        const response = await patch("/resetpassword")
            .send({ email: user.email, token, password: "newpass123", passwordRepeat: "other123" });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe("Passwords must match");
    });

    it("changes the password so the new one works and the old one does not", async () => {
        const user = await registerUser();
        const token = await requestResetToken(user);

        const response = await patch("/resetpassword")
            .send({
                email: user.email,
                token,
                password: "newpassword123",
                passwordRepeat: "newpassword123",
            });

        expect(response.status).toBe(200);

        const stored = await db.users.findOne({ email: user.email.toLowerCase() });
        expect(await bcrypt.compare("newpassword123", stored.password)).toBe(true);
        expect(await bcrypt.compare(user.password, stored.password)).toBe(false);
    });

    // Regression test for defect S1 (roadmap spec §5, fixed): loginRouter.js
    // unset `passwordtoken` (lowercase t) while the field is written as
    // `passwordToken`, so a reset token survived use and stayed valid forever.
    it("invalidates the reset token after it has been used", async () => {
        const user = await registerUser();
        const token = await requestResetToken(user);

        await patch("/resetpassword").send({
            email: user.email,
            token,
            password: "newpassword123",
            passwordRepeat: "newpassword123",
        });

        const stored = await db.users.findOne({ email: user.email.toLowerCase() });
        expect(stored.passwordToken).toBeUndefined();

        // And it cannot be used a second time.
        const reuse = await patch("/resetpassword")
            .send({
                email: user.email,
                token,
                password: "thirdpassword123",
                passwordRepeat: "thirdpassword123",
            });

        expect(reuse.status).toBe(400);
    });
});

describe("defect S9: operator injection through the request body (roadmap spec §5, fixed)", () => {
    // Regression test for defect S9 (roadmap spec §5, fixed): sanitizeRequest
    // was registered before express.json(), so `sanitize(req.body)` ran
    // against `undefined` and never touched the parsed body. Both
    // /resetpassword routes pass `clientUser.token` straight into a Mongo
    // query, so sending the operator `{ "$ne": null }` in place of a token
    // matched any user whose passwordToken was set — which, combined with S1
    // (the token was never invalidated), was true forever for any victim who
    // had ever used "forgot password". A full unauthenticated account
    // takeover with zero knowledge of the real token.
    it("rejects a Mongo operator supplied in place of a reset token", async () => {
        const victim = await registerUser();
        await post("/forgotpassword").send({ email: victim.email });

        const attackerChosenPassword = "attacker-chosen-password";

        const readResponse = await post("/resetpassword").send({
            email: victim.email,
            token: { $ne: null },
        });
        expect(readResponse.status).toBe(400);

        const patchResponse = await patch("/resetpassword").send({
            email: victim.email,
            token: { $ne: null },
            password: attackerChosenPassword,
            passwordRepeat: attackerChosenPassword,
        });
        expect(patchResponse.status).toBe(400);

        // The victim's password is untouched, so the attacker cannot log in.
        const loginResponse = await request(app)
            .post("/login")
            .set("X-Forwarded-For", uniqueIp())
            .send({ email: victim.email, password: attackerChosenPassword });
        expect(loginResponse.status).toBe(400);
    });

    it("still lets a legitimate token change the password", async () => {
        const user = await registerUser();
        const token = await requestResetToken(user);

        const response = await patch("/resetpassword").send({
            email: user.email,
            token,
            password: "legitimate-new-password",
            passwordRepeat: "legitimate-new-password",
        });

        expect(response.status).toBe(200);

        const login = await request(app)
            .post("/login")
            .set("X-Forwarded-For", uniqueIp())
            .send({ email: user.email, password: "legitimate-new-password" });
        expect(login.status).toBe(200);
    });
});

// DEFECT S10 (roadmap spec §5): `PATCH /resetpassword` never checked that a
// token was supplied at all — `POST` did, `PATCH` did not. With `token`
// absent, `clientUser.token` is `undefined`, the driver serializes it to BSON
// `null`, and `{ passwordToken: null }` matches every document where the field
// is null *or absent*. So an attacker knowing only a victim's email could
// replace their password in one unauthenticated request. No sanitizer can stop
// this — `null` is not an operator — which is why the control is a type guard,
// not `mongo-sanitize`.
describe("defect S10: missing-token password reset (roadmap spec §5, fixed)", () => {
    it("rejects a password reset with no token at all", async () => {
        const victim = await registerUser();

        const response = await patch("/resetpassword").send({
            email: victim.email,
            password: "attacker-chosen-password",
            passwordRepeat: "attacker-chosen-password",
        });

        expect(response.status).toBe(400);

        const login = await request(app)
            .post("/login")
            .set("X-Forwarded-For", uniqueIp())
            .send({ email: victim.email, password: "attacker-chosen-password" });
        expect(login.status).toBe(400);
    });

    it("rejects a null token", async () => {
        const victim = await registerUser();

        const response = await patch("/resetpassword").send({
            email: victim.email,
            token: null,
            password: "attacker-chosen-password",
            passwordRepeat: "attacker-chosen-password",
        });

        expect(response.status).toBe(400);
    });

    // Correcting S1 removed the leftover passwordToken string that had been
    // accidentally shielding this population from the null match, so they went
    // from safe to exploitable. This pins that they are safe for a real reason.
    it("rejects a missing token against a victim who already completed a reset", async () => {
        const victim = await registerUser();
        const token = await requestResetToken(victim);
        await patch("/resetpassword").send({
            email: victim.email,
            token,
            password: "victims-own-new-password",
            passwordRepeat: "victims-own-new-password",
        });

        const response = await patch("/resetpassword").send({
            email: victim.email,
            password: "attacker-chosen-password",
            passwordRepeat: "attacker-chosen-password",
        });

        expect(response.status).toBe(400);
    });
});
