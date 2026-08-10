import { Router } from "express";
import db from "../database/createConnection.js";
import bcrypt from "bcrypt";
import mailer from "../mailer/mailer.js";
import { sendError } from "../errors.js";
const router = Router();

// Signup fields must be strings before anything reads them. mongo-sanitize
// turns an operator into `{}`, which is truthy and therefore sails past a
// bare falsiness check — that is how `username: {"$ne": null}` ended up
// stored as `{}` and put into the session. See defect N2.
const SIGNUP_FIELDS = ["email", "username", "password", "passwordRepeat"];

router.post("/users", async (req, res) => {
    const clientUser = req.body;

    if (
        SIGNUP_FIELDS.some(
            (field) => typeof clientUser[field] !== "string" || clientUser[field].length === 0
        )
    ) {
        sendError(res, "VALIDATION_FAILED", "All fields must be filled");
        return;
    }
    if (clientUser.password !== clientUser.passwordRepeat) {
        sendError(res, "VALIDATION_FAILED", "Passwords must match");
        return;
    }
    if (clientUser.password.length < 8 || clientUser.password.length > 24) {
        sendError(res, "VALIDATION_FAILED", "Password must be between 8 and 24 characters");
        return;
    }
    if (!/\S+@\S+\.\S+/.test(clientUser.email)) {
        sendError(res, "VALIDATION_FAILED", "Email must be valid");
        return;
    }
    if (clientUser.username.length < 3 || clientUser.username.length > 16) {
        sendError(res, "VALIDATION_FAILED", "Username must be between 3 and 16 characters");
        return;
    }
    const findUsername = await db.users
        .find({ username: clientUser.username })
        .collation({ locale: "en", strength: 1 })
        .toArray();
    if (findUsername.length !== 0) {
        sendError(res, "CONFLICT", "Username already exists");
        return;
    }
    const findEmail = await db.users.findOne({ email: clientUser.email.toLowerCase() });
    if (findEmail !== null) {
        sendError(res, "CONFLICT", "Email already exists");
        return;
    }

    const hashedPassword = await bcrypt.hash(clientUser.password, 12);
    await db.users.insertOne({
        username: clientUser.username,
        email: clientUser.email.toLowerCase(),
        password: hashedPassword,
    });
    void mailer("Account Created", "<h1>You created an account!<h1>", clientUser.email);
    res.status(200).send({ message: "User created" });
});

export default router;
