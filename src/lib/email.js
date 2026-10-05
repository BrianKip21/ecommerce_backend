import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: false,

    family: 4,

    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    },

    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 10000
});

export const sendPasswordResetEmail = async (toEmail, resetUrl) => {
    await transporter.sendMail({
        from: `"Liaan Collections" <${process.env.SMTP_USER}>`,
        to: toEmail,
        subject: "Reset your Liaan Collections password",
        html: `
            <h2>Reset your password</h2>
            <p>Click the button below to reset your password.</p>

            <a href="${resetUrl}">
                Reset Password
            </a>

            <p>This link expires in 1 hour.</p>
        `
    });
};