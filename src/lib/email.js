import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL =
    process.env.EMAIL_FROM ||
    "Liaan Collections <onboarding@resend.dev>";

const buildEmailTemplate = ({
    title,
    heading,
    paragraphs = [],
    buttonText,
    buttonUrl,
    expiryText,
    warningText
}) => {
    return `
        <div style="
            font-family: Arial, Helvetica, sans-serif;
            background-color: #ffffff;
            color: #171717;
            max-width: 600px;
            margin: 0 auto;
            padding: 40px 20px;
        ">

            <!-- Brand -->
            <div style="
                margin-bottom: 35px;
                text-align: center;
            ">
                <h1 style="
                    margin: 0;
                    font-size: 24px;
                    font-weight: 700;
                    letter-spacing: 0.5px;
                ">
                    Liaan Collections
                </h1>
            </div>

            <!-- Content -->
            <div>
                <h2 style="
                    font-size: 26px;
                    line-height: 1.3;
                    margin: 0 0 24px;
                    font-weight: 600;
                ">
                    ${heading}
                </h2>

                ${paragraphs
                    .map(
                        (paragraph) => `
                            <p style="
                                font-size: 16px;
                                line-height: 1.7;
                                margin: 0 0 16px;
                                color: #333333;
                            ">
                                ${paragraph}
                            </p>
                        `
                    )
                    .join("")}

                ${
                    buttonUrl
                        ? `
                            <div style="
                                margin: 32px 0;
                            ">
                                <a
                                    href="${buttonUrl}"
                                    style="
                                        display: inline-block;
                                        background-color: #000000;
                                        color: #ffffff;
                                        padding: 14px 24px;
                                        text-decoration: none;
                                        border-radius: 4px;
                                        font-size: 15px;
                                        font-weight: 600;
                                    "
                                >
                                    ${buttonText}
                                </a>
                            </div>
                        `
                        : ""
                }

                ${
                    expiryText
                        ? `
                            <p style="
                                font-size: 14px;
                                line-height: 1.6;
                                color: #666666;
                                margin: 0 0 12px;
                            ">
                                ${expiryText}
                            </p>
                        `
                        : ""
                }

                ${
                    warningText
                        ? `
                            <p style="
                                font-size: 14px;
                                line-height: 1.6;
                                color: #666666;
                                margin: 0 0 20px;
                            ">
                                ${warningText}
                            </p>
                        `
                        : ""
                }
            </div>

            <!-- Footer -->
            <div style="
                margin-top: 40px;
                padding-top: 24px;
                border-top: 1px solid #eeeeee;
            ">
                <p style="
                    margin: 0;
                    font-size: 12px;
                    line-height: 1.6;
                    color: #999999;
                    text-align: center;
                ">
                    © ${new Date().getFullYear()} Liaan Collections.
                    All rights reserved.
                </p>
            </div>

        </div>
    `;
};

/**
 * Send password reset email
 */
export const sendPasswordResetEmail = async (
    toEmail,
    resetUrl
) => {
    if (!toEmail || !resetUrl) {
        throw new Error(
            "Email address and reset URL are required"
        );
    }

    const { data, error } = await resend.emails.send({
        from: FROM_EMAIL,
        to: [toEmail],
        subject: "Reset your Liaan Collections password",

        html: buildEmailTemplate({
            heading: "Reset your password",

            paragraphs: [
                `We received a request to reset the password
                 for your Liaan Collections account.`,

                `Click the button below to choose a new password.`
            ],

            buttonText: "Reset Password",
            buttonUrl: resetUrl,

            expiryText:
                "This password reset link will expire in 1 hour.",

            warningText:
                "If you didn't request a password reset, you can safely ignore this email."
        })
    });

    if (error) {
        console.error(
            "Resend password reset email error:",
            error
        );

        throw new Error(
            "Failed to send password reset email"
        );
    }

    console.log(
        "Password reset email sent:",
        data?.id
    );

    return data;
};

/**
 * Send email-change verification email
 */
export const sendEmailChangeVerification = async (
    toEmail,
    confirmUrl
) => {
    if (!toEmail || !confirmUrl) {
        throw new Error(
            "Email address and confirmation URL are required"
        );
    }

    const { data, error } = await resend.emails.send({
        from: FROM_EMAIL,
        to: [toEmail],
        subject:
            "Confirm your new Liaan Collections email address",

        html: buildEmailTemplate({
            heading: "Confirm your new email address",

            paragraphs: [
                `We received a request to change the email address
                 associated with your Liaan Collections account.`,

                `Click the button below to confirm your new email address.`
            ],

            buttonText: "Confirm Email",
            buttonUrl: confirmUrl,

            expiryText:
                "This email verification link will expire in 1 hour.",

            warningText:
                "If you didn't request this change, you can safely ignore this email."
        })
    });

    if (error) {
        console.error(
            "Resend email change verification error:",
            error
        );

        throw new Error(
            "Failed to send email change verification"
        );
    }

    console.log(
        "Email change verification sent:",
        data?.id
    );

    return data;
};