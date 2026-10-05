import User from "../../models/user.model.js";
import { generateToken } from "../../lib/utils.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { OAuth2Client } from "google-auth-library";
import { sendPasswordResetEmail } from "../../lib/email.js";
import { mergeGuestCartIntoUser } from "../../services/cart.service.js";

const googleClient = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID
);


// =========================
// SIGNUP
// =========================

export const signup = async (req, res) => {
    const { fullName, email, password } = req.body;

    try {
        if (
            typeof fullName !== "string" ||
            typeof email !== "string" ||
            typeof password !== "string"
        ) {
            return res.status(400).json({
                message: "All fields are required"
            });
        }

        const normalizedFullName = fullName.trim();
        const normalizedEmail = email.trim().toLowerCase();

        if (!normalizedFullName || !normalizedEmail || !password) {
            return res.status(400).json({
                message: "All fields are required"
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                message: "Password must be at least 6 characters"
            });
        }

        const user = await User.findOne({
            email: normalizedEmail
        });

        if (user) {
            return res.status(400).json({
                message: "User already exists"
            });
        }

        const salt = await bcrypt.genSalt(10);

        const hashedPassword = await bcrypt.hash(
            password,
            salt
        );

        const newUser = new User({
            fullName: normalizedFullName,
            email: normalizedEmail,
            password: hashedPassword,
            role: "user"
        });

        await newUser.save();

        generateToken(newUser._id, res);

        await mergeGuestCartIntoUser(
            req.cookies?.guestId,
            newUser._id
        );

        res.clearCookie("guestId", {
            httpOnly: true,
            sameSite: "strict",
            secure: process.env.NODE_ENV === "production"
        });

        return res.status(201).json({
            _id: newUser._id,
            fullName: newUser.fullName,
            email: newUser.email
        });

    } catch (error) {
        console.error(
            "Error in signup controller:",
            error.message
        );

        return res.status(500).json({
            message: "Internal server error"
        });
    }
};


// =========================
// LOGIN
// =========================

export const login = async (req, res) => {
    const { email, password } = req.body;

    try {
        if (
            typeof email !== "string" ||
            typeof password !== "string"
        ) {
            return res.status(400).json({
                message: "Email and password are required"
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        const user = await User.findOne({
            email: normalizedEmail
        });

        if (!user) {
            return res.status(400).json({
                message: "Invalid credentials"
            });
        }

        // Google-only account
        if (!user.password) {
            return res.status(400).json({
                message:
                    "This account uses Google login. Please continue with Google."
            });
        }

        const isPasswordCorrect = await bcrypt.compare(
            password,
            user.password
        );

        if (!isPasswordCorrect) {
            return res.status(400).json({
                message: "Invalid credentials"
            });
        }

        generateToken(user._id, res);

        await mergeGuestCartIntoUser(
            req.cookies?.guestId,
            user._id
        );

        res.clearCookie("guestId", {
            httpOnly: true,
            sameSite: "strict",
            secure: process.env.NODE_ENV === "production"
        });

        return res.status(200).json({
            _id: user._id,
            fullName: user.fullName,
            email: user.email
        });

    } catch (error) {
        console.error(
            "Error in login controller:",
            error.message
        );

        return res.status(500).json({
            message: "Internal server error"
        });
    }
};


// =========================
// GOOGLE AUTHENTICATION
// =========================

export const googleAuth = async (req, res) => {
    try {
        const { credential } = req.body;

        if (!credential) {
            return res.status(400).json({
                message: "Google credential is required"
            });
        }

        // Verify Google's ID token
        const ticket = await googleClient.verifyIdToken({
            idToken: credential,
            audience: process.env.GOOGLE_CLIENT_ID
        });

        const payload = ticket.getPayload();

        const {
            sub: googleId,
            email,
            name
        } = payload;

        if (!googleId || !email) {
            return res.status(400).json({
                message: "Invalid Google account information"
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        // Find existing user by Google ID OR email
        let user = await User.findOne({
            $or: [
                { googleId },
                { email: normalizedEmail }
            ]
        });

        if (user) {

            // Existing local account:
            // Link the Google account to it.
            if (!user.googleId) {
                user.googleId = googleId;
                await user.save();
            }

        } else {

            // Create a new Google user
            user = new User({
                fullName: name || "Google User",
                email: normalizedEmail,
                googleId,
                role: "user"
            });

            await user.save();
        }

        // Generate your application's JWT
        generateToken(user._id, res);

        // Merge guest cart into authenticated user's cart
        await mergeGuestCartIntoUser(
            req.cookies?.guestId,
            user._id
        );

        // Remove guest cart cookie
        res.clearCookie("guestId", {
            httpOnly: true,
            sameSite: "strict",
            secure: process.env.NODE_ENV === "production"
        });

        return res.status(200).json({
            _id: user._id,
            fullName: user.fullName,
            email: user.email
        });

    } catch (error) {
        console.error(
            "Error in Google authentication:",
            error.message
        );

        return res.status(500).json({
            message: "Internal server error"
        });
    }
};

export const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;

        if (typeof email !== "string" || !email.trim()) {
            return res.status(400).json({
                message: "Email is required"
            });
        }

        const normalizedEmail = email.trim().toLowerCase();

        const user = await User.findOne({
            email: normalizedEmail
        });

        // Always return the same response whether or not
        // the email exists to prevent account enumeration.
        if (!user) {
            return res.status(200).json({
                success: true,
                message:
                    "If that email is registered, a reset link has been sent."
            });
        }

        // Generate a secure random token.
        const rawToken = crypto
            .randomBytes(32)
            .toString("hex");

        // Store only the hashed version in the database.
        const hashedToken = crypto
            .createHash("sha256")
            .update(rawToken)
            .digest("hex");

        user.resetPasswordToken = hashedToken;

        user.resetPasswordExpires =
            Date.now() + 60 * 60 * 1000; // 1 hour

        await user.save();

        // Only the raw token is sent to the user.
        const resetUrl =
            `${process.env.FRONTEND_URL}/reset-password/${rawToken}`;

        await sendPasswordResetEmail(
            user.email,
            resetUrl
        );

        return res.status(200).json({
            success: true,
            message:
                "If that email is registered, a reset link has been sent."
        });

    } catch (error) {
        console.error(
            "Error in forgot password controller:",
            error.message
        );

        return res.status(500).json({
            message: "Internal server error"
        });
    }
};

export const resetPassword = async (req, res) => {
    try {
        const { token } = req.params;
        const { password } = req.body;

        if (
            typeof password !== "string" ||
            password.length < 6
        ) {
            return res.status(400).json({
                message: "Password must be at least 6 characters"
            });
        }

        // Hash the token received from the reset URL.
        const hashedToken = crypto
            .createHash("sha256")
            .update(token)
            .digest("hex");

        // Find a user whose token exists and has not expired.
        const user = await User.findOne({
            resetPasswordToken: hashedToken,
            resetPasswordExpires: {
                $gt: Date.now()
            }
        });

        if (!user) {
            return res.status(400).json({
                message:
                    "Reset link is invalid or has expired"
            });
        }

        const salt = await bcrypt.genSalt(10);

        user.password = await bcrypt.hash(
            password,
            salt
        );

        // Invalidate the reset token immediately.
        user.resetPasswordToken = null;
        user.resetPasswordExpires = null;

        await user.save();

        return res.status(200).json({
            success: true,
            message:
                "Password reset successfully. You can now log in."
        });

    } catch (error) {
        console.error(
            "Error in reset password controller:",
            error.message
        );

        return res.status(500).json({
            message: "Internal server error"
        });
    }
};


// =========================
// GET CURRENT USER
// =========================

export const getMe = async (req, res) => {
    return res.status(200).json({
        _id: req.user._id,
        fullName: req.user.fullName,
        email: req.user.email
    });
};


// =========================
// LOGOUT
// =========================

export const logout = async (req, res) => {
    res.clearCookie("jwt");

    return res.status(200).json({
        success: true,
        message: "Logged out successfully"
    });
};
