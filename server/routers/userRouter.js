import { Router } from "express";
import db from "../database/createConnection.js";
import bcrypt from "bcrypt";
import mailer from "../mailer/mailer.js";
const router = Router();

router.post("/users", async (req, res) => {
    const clientUser = req.body;

    if(!clientUser.email || !clientUser.username || !clientUser.password || !clientUser.passwordRepeat) {
        res.status(400).send({ message: "All fields must be filled" });
        return;
    }
    if(clientUser.password !== clientUser.passwordRepeat) {
        res.status(400).send({ message: "Passwords must match" });
        return;
    }
    if(clientUser.password.length < 8) {
        res.status(400).send({ message: "Password is too short" });
        return;
    }
    if(!/\S+@\S+\.\S+/.test(clientUser.email)) {
        res.status(400).send({ message: "Email must be valid" });
        return;
    }

    const emailExists = await db.users.findOne({ email: clientUser.email.toLowerCase() });
    if(emailExists === null) {
        const hashedPassword = await bcrypt.hash(clientUser.password, 12);
        await db.users.insertOne({ username: clientUser.username, email: clientUser.email.toLowerCase(), password: hashedPassword });
        mailer("Account Created", "<h1>You created an account!<h1>", clientUser.email);
        res.status(200).send({ message: "User created" });
    } else {
        res.status(400).send({ message: "Email already exists" });
    }
});

export default router;