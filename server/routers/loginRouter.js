import { Router } from "express";
import bcrypt from "bcrypt";
import db from "../database/createConnection.js";
import mailer from "../mailer/mailer.js";
import crypto from "crypto";
const router = Router();

router.get("/logout", (req, res) => {
    req.session.destroy();
    res.status(200).send({ message: "Successfully logged out" });
});

router.post("/login", async (req, res) => {
    const clientUser = req.body;

    if(!clientUser.email || !clientUser.password) {
        res.status(400).send({ message: "All fields must be filled" });
        return;
    }

    const serverUser = await db.users.findOne({ email: clientUser.email.toLowerCase() });

    if(serverUser === null) {
        res.status(400).send({ message: "Email doesn't exist" });
        return;
    }

    if(await bcrypt.compare(clientUser.password, serverUser.password)) {
        const { password, passwordToken, ...responseUser } = serverUser;
        req.session.loggedIn = true;
        req.session.userID = serverUser._id;
        req.session.email = serverUser.email;
        req.session.username = serverUser.username;

        res.status(200).send({ data: responseUser, message: "Successfully logged in"});
    } else {
        res.status(400).send({ message: "Password doesn't match" });
    }
});

router.post("/forgotpassword", async (req, res) => {
    const clientUser = req.body;
    
    if(!clientUser.email) {
        res.status(400).send({ message: "All fields must be filled" });
        return;
    }
    if(!/\S+@\S+\.\S+/.test(clientUser.email)) {
        res.status(400).send({ message: "Email must be valid" });
        return;
    }
    
    const serverUser = await db.users.findOne({ email: clientUser.email.toLowerCase() });

    if(serverUser === null) {
        res.status(200).send({ message: "If this email is tied to a user, an email has been sent to it." });
        return;
    }

    const token = crypto.randomBytes(3).toString('hex');
    await db.users.updateOne({ email: serverUser.email.toLowerCase() }, { $set: { passwordToken: token }});

    mailer("Forgot Password", `<span style="font-size: 25px;">Code to use for password reset:</span> <span style="font-size: 35px;">${token}</span>`, clientUser.email);
    res.status(200).send({ message: "If this email is tied to a user, an email has been sent to it." });
});

router.post("/resetpassword", async (req, res) => {
    const clientUser = req.body;

    if(!clientUser.token) {
        res.status(400).send({ message: "Code must be filled"});
        return;
    }

    const serverUser = await db.users.findOne({ passwordToken: clientUser.token, email: clientUser.email.toLowerCase() });

    if(serverUser === null) {
        res.status(400).send({ message: "Code is invalid" });
        return;
    }
    
    res.status(200).send({});
});

router.patch("/resetpassword", async (req, res) => {
    const clientUser = req.body;

    if(!clientUser.password || !clientUser.passwordRepeat) {
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

    const serverUser = await db.users.findOne({ passwordToken: clientUser.token, email: clientUser.email.toLowerCase() });

    if(serverUser === null) {
        res.status(400).send({ message: "Something went wrong, try to start over" });
        return;
    }

    const newPassword = await bcrypt.hash(clientUser.password, 12);
    await db.users.updateOne({ email: clientUser.email.toLowerCase(), passwordToken: clientUser.token }, { $set: { password: newPassword }, $unset: { passwordtoken: "" }});
    mailer("Password changed successfully", `<h2>Your password has been changed!</h2>`, clientUser.email);
    res.status(200).send({ message: "Password changed successfully" });
});

export default router;