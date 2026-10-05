import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export const sendPasswordResetEmail = async (toEmail, resetUrl) => {
    const { data, error } = await resend.emails.send({
        from: "Liaan Collections <onboarding@resend.dev>",
        to: [toEmail],
        subject: "Reset your Liaan Collections password",

        html: `
            <div style="
                font-family: Arial, sans-serif;
                max-width: 600px;
                margin: 0 auto;
                padding: 40px 20px;
                color: #171717;
            ">

                <h1 style="
                    font-size: 28px;
                    margin-bottom: 20px;
                ">
                    Reset your password
                </h1>

                <p style="
                    font-size: 16px;
                    line-height: 1.6;
                ">
                    We received a request to reset your
                    Liaan Collections password.
                </p>

                <p style="
                    font-size: 16px;
                    line-height: 1.6;
                ">
                    Click the button below to choose a new password.
                </p>

                <div style="margin: 30px 0;">
                    <a
                        href="${resetUrl}"
                        style="
                            display: inline-block;
                            background: #000000;
                            color: #ffffff;
                            padding: 14px 24px;
                            text-decoration: none;
                            border-radius: 4px;
                            font-size: 15px;
                        "
                    >
                        Reset Password
                    </a>
                </div>

                <p style="
                    font-size: 14px;
                    color: #666666;
                    line-height: 1.6;
                ">
                    This password reset link will expire in 1 hour.
                </p>

                <p style="
                    font-size: 14px;
                    color: #666666;
                    line-height: 1.6;
                ">
                    If you didn't request a password reset,
                    you can safely ignore this email.
                </p>

                <hr style="
                    border: none;
                    border-top: 1px solid #eeeeee;
                    margin: 30px 0;
                ">

                <p style="
                    font-size: 12px;
                    color: #999999;
                ">
                    © Liaan Collections
                </p>

            </div>
        `
    });

    if (error) {
        console.error("Resend email error:", error);
        throw new Error("Failed to send password reset email");
    }

    console.log("Password reset email sent:", data?.id);

    return data;
};