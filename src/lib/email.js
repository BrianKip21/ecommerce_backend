import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: Number(process.env.SMTP_PORT) === 465,

    family: 4,

    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

export const sendPasswordResetEmail = async (toEmail, resetUrl) => {
    await transporter.sendMail({
        from: `"Liaan Collections" <${process.env.SMTP_USER}>`,
        to: toEmail,
        subject: "Reset your Liaan Collections password",
        html: `
            <h2>Reset your password</h2>
            <p>Click the button below to reset your Liaan Collections password.</p>

            <a href="${resetUrl}"
               style="
                   display:inline-block;
                   padding:12px 20px;
                   background:#000;
                   color:#fff;
                   text-decoration:none;
                   border-radius:4px;
               ">
                Reset Password
            </a>

            <p>This link expires in 1 hour.</p>
        `
    });
};