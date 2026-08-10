import { Router } from "express";
import db from "../database/createConnection.js";
import bcrypt from "bcrypt";
import mailer from "../mailer/mailer.js";
import { sendError } from "../errors.js";
import { validateBody } from "../validate.js";
import { signupSchema } from "../schemas.js";
const router = Router();

/**
 * Take an unused invite code out of circulation, atomically.
 *
 * Reading the code and then marking it used loses a race between two people
 * holding the same code: both read it as unused and both sign up. The filter
 * carries `usedAt: null`, so exactly one findOneAndUpdate can match.
 *
 * `usedBy` is filled in afterwards, once the account it belongs to exists.
 * Roadmap §3, hedge 1.
 */
async function claimInvite(code) {
    return db.invites.findOneAndUpdate(
        { code, usedAt: null },
        { $set: { usedAt: new Date() } },
        { returnDocument: "after" }
    );
}

function registrationIsInviteOnly() {
    // Read per request, not at boot: closing registration is the kind of thing
    // wanted in a hurry, and this way it does not need a deploy.
    return process.env.INVITE_ONLY === "true";
}

router.post("/users", validateBody(signupSchema), async (req, res) => {
    const clientUser = req.body;
    const inviteOnly = registrationIsInviteOnly();

    // Checked before anything else so a closed registration says so, rather
    // than leaking whether a username is taken to someone who cannot sign up.
    if (inviteOnly) {
        const invite = await db.invites.findOne({
            code: clientUser.inviteCode ?? "",
            usedAt: null,
        });
        if (invite === null) {
            sendError(res, "FORBIDDEN", "Registration is invite only");
            return;
        }
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

    // Claimed only once the signup is otherwise certain to succeed, so a typo
    // in the username does not burn someone's only invite. The claim is still
    // the last thing that can fail: two people holding one code both reach
    // here, and only one of them takes it.
    let claimed = null;
    if (inviteOnly) {
        claimed = await claimInvite(clientUser.inviteCode);
        if (claimed === null) {
            sendError(res, "FORBIDDEN", "Registration is invite only");
            return;
        }
    }

    const hashedPassword = await bcrypt.hash(clientUser.password, 12);
    let inserted;
    try {
        inserted = await db.users.insertOne({
            username: clientUser.username,
            email: clientUser.email.toLowerCase(),
            password: hashedPassword,
            // Written explicitly so Phase 9 never has to read an absent field as
            // a state. See the hedge in createConnection.js.
            moderationState: "active",
        });
    } catch (error) {
        // The unique indexes on username and email can still reject this if two
        // signups raced past the checks above. Put the invite back rather than
        // consuming it for an account that does not exist.
        if (claimed !== null) {
            await db.invites.updateOne({ _id: claimed._id }, { $set: { usedAt: null } });
        }
        throw error;
    }

    if (claimed !== null) {
        await db.invites.updateOne(
            { _id: claimed._id },
            { $set: { usedBy: inserted.insertedId.toString() } }
        );
    }

    void mailer("Account Created", "<h1>You created an account!<h1>", clientUser.email);
    res.status(200).send({ message: "User created" });
});

export default router;
