import nodemailer from "nodemailer";
import "dotenv/config";

export default async function main(title, htmlContent, emailAddress) {
    let transporter = nodemailer.createTransport({
        service: "Gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
      },
    });
    
  let info = await transporter.sendMail({
    from: '"FlixDrive" <flixdrive.mailer@gmail.com>',
    to: emailAddress,
    subject: title,
    html: htmlContent
  });

  console.log("Message sent: %s", info.messageId);
}