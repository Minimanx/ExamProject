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
    if(clientUser.password.length < 8 || clientUser.password.length > 24) {
        res.status(400).send({ message: "Password must be between 8 and 24 characters" });
        return;
    }
    if(!/\S+@\S+\.\S+/.test(clientUser.email)) {
        res.status(400).send({ message: "Email must be valid" });
        return;
    }
    if(clientUser.username < 3 || clientUser.username > 16) {
        res.status(400).send({ message: "Username must be between 3 and 16 characters" });
        return;
    }
    const findUsername = await db.users.find({ username: clientUser.username }).collation({ locale: "en", strength: 1 }).toArray();
    if(findUsername.length !== 0) {
        res.status(400).send({ message: "Username already exists" });
        return;
    }
    const findEmail = await db.users.findOne({ email: clientUser.email.toLowerCase() });
    if(findEmail !== null) {
        res.status(400).send({ message: "Email already exists" });
        return;
    }

    const hashedPassword = await bcrypt.hash(clientUser.password, 12);
    await db.users.insertOne({ username: clientUser.username, email: clientUser.email.toLowerCase(), password: hashedPassword });
    mailer("Account Created", "<h1>You created an account!<h1>", clientUser.email);
    res.status(200).send({ message: "User created" });
});

export default router;