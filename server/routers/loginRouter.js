import { Router } from "express";
import bcrypt from "bcrypt";
import db from "../database/createConnection.js";
import { ObjectId } from "mongodb";
import mailer from "../mailer/mailer.js";
import crypto from "crypto";
import { sendError } from "../errors.js";
import { validateBody } from "../validate.js";
import {
    loginSchema,
    forgotPasswordSchema,
    checkResetTokenSchema,
    resetPasswordSchema,
} from "../schemas.js";
const router = Router();

/**
 * Who the server thinks you are.
 *
 * The client keeps "am I logged in" in localStorage, which outlives the session
 * it describes — a server restart, an expiry, a logout in another tab. Without
 * something to ask, it renders the entire world for somebody the server does
 * not know: driving around, typing into a chat that goes nowhere, invisible to
 * everyone else and unable to join anything.
 */
router.get("/me", async (req, res) => {
    if (!req.session.loggedIn) {
        return sendError(res, "UNAUTHENTICATED", "Must be logged in");
    }

    const user = await db.users.findOne(
        { _id: new ObjectId(req.session.userID) },
        // Only what the client displays. It has no use for the address, and this
        // is the response it stores.
        { projection: { username: 1 } }
    );
    if (user === null) {
        // The session outlived the account it belongs to.
        req.session.destroy();
        return sendError(res, "UNAUTHENTICATED", "Must be logged in");
    }

    res.status(200).send({ data: user });
});

router.get("/logout", (req, res) => {
    req.session.destroy();
    res.status(200).send({ message: "Successfully logged out" });
});

router.post("/login", validateBody(loginSchema), async (req, res) => {
    const clientUser = req.body;

    const serverUser = await db.users.findOne({ email: clientUser.email.toLowerCase() });

    if (serverUser === null) {
        sendError(res, "UNAUTHENTICATED", "Email or password incorrect");
        return;
    }

    if (await bcrypt.compare(clientUser.password, serverUser.password)) {
        const { password, passwordToken, ...responseUser } = serverUser;
        req.session.loggedIn = true;
        req.session.userID = serverUser._id.toString();
        req.session.email = serverUser.email;
        req.session.username = serverUser.username;

        res.status(200).send({ data: responseUser, message: "Successfully logged in" });
    } else {
        sendError(res, "UNAUTHENTICATED", "Email or password incorrect");
    }
});

router.post("/forgotpassword", validateBody(forgotPasswordSchema), async (req, res) => {
    const clientUser = req.body;

    const serverUser = await db.users.findOne({ email: clientUser.email.toLowerCase() });

    if (serverUser === null) {
        res.status(200).send({
            message: "If this email is tied to a user, an email has been sent to it.",
        });
        return;
    }

    const token = crypto.randomBytes(RESET_TOKEN_BYTES).toString("hex");
    await db.users.updateOne(
        { email: serverUser.email.toLowerCase() },
        {
            $set: {
                passwordToken: token,
                passwordTokenExpiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
            },
            // A fresh token starts with a fresh budget, or the attempts spent
            // against the previous one would carry over and burn it early.
            $unset: { passwordTokenAttempts: "" },
        }
    );

    void mailer(
        "Forgot Password",
        `<span style="font-size: 25px;">Code to use for password reset:</span> <span style="font-size: 35px;">${token}</span>`,
        clientUser.email
    );
    res.status(200).send({
        message: "If this email is tied to a user, an email has been sent to it.",
    });
});

// Three controls bound a reset token, and each covers a different failure the
// others cannot. Single-use (S1) bounds the reward for one guess; the TTL
// bounds how long a leaked or intercepted token is worth anything; the attempt
// cap bounds how many guesses one issued token will tolerate. Entropy is what
// makes the search hopeless in the first place: 6 hex characters is 16.7M
// values, which a distributed attacker exhausts in days. See defect S2.
const RESET_TOKEN_BYTES = 8;
const RESET_TOKEN_TTL_MS = 15 * 60 * 1000;
const MAX_RESET_TOKEN_ATTEMPTS = 5;

const clearedResetFields = {
    passwordToken: "",
    passwordTokenExpiresAt: "",
    passwordTokenAttempts: "",
};

// Returns the user the token belongs to, or null. A wrong guess spends one of
// the token's five attempts and the fifth burns it, so a token under attack
// dies rather than waiting to be found. The counter is per account, keyed on
// email, so guessing at one account cannot burn another's token.
async function findUserByActiveResetToken(clientUser) {
    const email = clientUser.email.toLowerCase();
    const serverUser = await db.users.findOne({
        email,
        passwordToken: clientUser.token,
        passwordTokenExpiresAt: { $gt: new Date() },
    });

    if (serverUser !== null) {
        return serverUser;
    }

    const afterAttempt = await db.users.findOneAndUpdate(
        { email, passwordToken: { $exists: true } },
        { $inc: { passwordTokenAttempts: 1 } },
        { returnDocument: "after" }
    );
    if (afterAttempt !== null && afterAttempt.passwordTokenAttempts >= MAX_RESET_TOKEN_ATTEMPTS) {
        await db.users.updateOne({ email }, { $unset: clearedResetFields });
    }
    return null;
}

router.post("/resetpassword", validateBody(checkResetTokenSchema), async (req, res) => {
    const clientUser = req.body;

    const serverUser = await findUserByActiveResetToken(clientUser);

    if (serverUser === null) {
        sendError(res, "VALIDATION_FAILED", "Code is invalid");
        return;
    }

    res.status(200).send({});
});

router.patch("/resetpassword", validateBody(resetPasswordSchema), async (req, res) => {
    const clientUser = req.body;

    const serverUser = await findUserByActiveResetToken(clientUser);

    if (serverUser === null) {
        sendError(res, "VALIDATION_FAILED", "Something went wrong, try to start over");
        return;
    }

    const newPassword = await bcrypt.hash(clientUser.password, 12);
    await db.users.updateOne(
        { email: clientUser.email.toLowerCase(), passwordToken: clientUser.token },
        { $set: { password: newPassword }, $unset: clearedResetFields }
    );
    void mailer(
        "Password changed successfully",
        `<h2>Your password has been changed!</h2>`,
        clientUser.email
    );
    res.status(200).send({ message: "Password changed successfully" });
});

export default router;
