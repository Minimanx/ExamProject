import nodemailer from "nodemailer";
import "dotenv/config";

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  requireTLS: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  },
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 20000
});

export default async function sendEmail(title, htmlContent, emailAddress) {
  try {
    const info = await transporter.sendMail({
      from: `"FlixDrive" <${process.env.EMAIL_USER}>`,
      to: emailAddress,
      subject: title,
      html: htmlContent
    });

    console.log("Message sent: %s", info.messageId);
    return true;
  } catch (error) {
    console.error("Email delivery failed", {
      code: error.code,
      command: error.command,
      message: error.message
    });
    return false;
  }
}
