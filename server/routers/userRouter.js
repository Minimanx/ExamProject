import { Router } from "express";
import db from "../database/createConnection.js";
import bcrypt from "bcrypt";
import mailer from "../mailer/mailer.js";
import { sendError } from "../errors.js";
import { validateBody } from "../validate.js";
import { signupSchema } from "../schemas.js";
const router = Router();

router.post("/users", validateBody(signupSchema), async (req, res) => {
    const clientUser = req.body;

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
