import nodemailer from "nodemailer";
import "dotenv/config";
import { logger } from "../logger.js";

const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    requireTLS: true,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
});

export default async function sendEmail(title, htmlContent, emailAddress) {
    try {
        const info = await transporter.sendMail({
            from: `"FlixDrive" <${process.env.EMAIL_USER}>`,
            to: emailAddress,
            subject: title,
            html: htmlContent,
        });

        logger.info({ messageId: info.messageId }, "Email sent");
        return true;
    } catch (error) {
        logger.error(
            { code: error.code, command: error.command, reason: error.message },
            "Email delivery failed"
        );
        return false;
    }
}
