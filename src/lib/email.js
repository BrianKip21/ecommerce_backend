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
            <div
                style="
                    max-width: 600px;
                    margin: 0 auto;
                    padding: 32px 24px;
                    font-family: Arial, Helvetica, sans-serif;
                    color: #222;
                    line-height: 1.6;
                "
            >
                <h2 style="margin-bottom: 24px; color: #111;">
                    Reset your password
                </h2>

                <p>
                    We received a request to reset your
                    Liaan Collections password.
                </p>

                <p>
                    Click the button below to create a new password:
                </p>

                <div style="margin: 30px 0;">
                    <a
                        href="${resetUrl}"
                        style="
                            display: inline-block;
                            padding: 12px 24px;
                            background-color: #000;
                            color: #fff;
                            text-decoration: none;
                            border-radius: 6px;
                            font-weight: 600;
                        "
                    >
                        Reset Password
                    </a>
                </div>

                <p>
                    This password reset link will expire in
                    <strong>1 hour</strong>.
                </p>

                <p>
                    If you didn't request a password reset,
                    you can safely ignore this email.
                </p>

                <hr
                    style="
                        margin: 32px 0;
                        border: none;
                        border-top: 1px solid #eee;
                    "
                />

                <p style="font-size: 13px; color: #777;">
                    Liaan Collections
                </p>
            </div>
        `
    });
};