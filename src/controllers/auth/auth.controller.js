import User from "../../models/user.model.js";
import { generateToken } from "../../lib/utils.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { OAuth2Client } from "google-auth-library";
import { sendPasswordResetEmail } from "../../lib/email.js";
import { sendEmailChangeVerification } from "../../lib/email.js";
import { mergeGuestCartIntoUser } from "../../services/cart.service.js";

const googleClient = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID
);

const normalizeEmail = (email) => {
    return email.trim().toLowerCase();
};

const isValidEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

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
                success: false,
                message: "Email is required"
            });
        }

        const normalizedEmail =
            email.trim().toLowerCase();

        const user = await User.findOne({
            email: normalizedEmail
        });

        /*
         * Always return the same response when the account
         * does not exist to prevent account enumeration.
         */
        if (!user) {
            return res.status(200).json({
                success: true,
                message:
                    "If that email is registered, a reset link has been sent."
            });
        }

        /*
         * Google-only account.
         *
         * If there is a googleId but no password,
         * this account was created/authenticated through Google.
         */
        if (user.googleId && !user.password) {
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

        // Store only the hashed token.
        const hashedToken = crypto
            .createHash("sha256")
            .update(rawToken)
            .digest("hex");

        user.resetPasswordToken = hashedToken;

        // Token expires after 1 hour.
        user.resetPasswordExpires =
            Date.now() + 60 * 60 * 1000;

        await user.save();

        /*
         * Only the raw token is sent to the user.
         * The database contains only the hash.
         */
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
            success: false,
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
                success: false,
                message:
                    "Password must be at least 6 characters"
            });
        }

        if (
            typeof token !== "string" ||
            !token.trim()
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Reset link is invalid or has expired"
            });
        }

        // Hash the token from the reset URL.
        const hashedToken = crypto
            .createHash("sha256")
            .update(token)
            .digest("hex");

        /*
         * Find the account using:
         *
         * 1. Matching reset token
         * 2. Token hasn't expired
         */
        const user = await User.findOne({
            resetPasswordToken: hashedToken,
            resetPasswordExpires: {
                $gt: Date.now()
            }
        });

        if (!user) {
            return res.status(400).json({
                success: false,
                message:
                    "Reset link is invalid or has expired"
            });
        }

        /*
         * Do not allow the normal password-reset flow
         * to create a password for a Google-only account.
         */
        if (user.googleId && !user.password) {
            return res.status(400).json({
                success: false,
                message:
                    "This account uses Google sign-in. Please continue with Google."
            });
        }

        // Hash the new password.
        const salt = await bcrypt.genSalt(10);

        user.password = await bcrypt.hash(
            password,
            salt
        );

        /*
         * Mark when the password changed.
         *
         * authenticate() uses this timestamp to invalidate
         * JWTs issued before the password change.
         */
        user.passwordChangedAt = new Date();

        /*
         * Invalidate the reset token immediately.
         * This makes the reset link single-use.
         */
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
            success: false,
            message: "Internal server error"
        });
    }
};

export const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ message: "Current and new password are required" });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ message: "New password must be at least 6 characters" });
        }

        const user = await User.findById(req.user._id).select("+password");
        const isCorrect = await bcrypt.compare(currentPassword, user.password);

        if (!isCorrect) {
            return res.status(400).json({ message: "Current password is incorrect" });
        }

        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
        user.passwordChangedAt = new Date();
        await user.save();

        // Re-issue a fresh token so THIS session survives the invalidation of older ones
        generateToken(user._id, res);

        return res.status(200).json({
            success: true,
            message: "Password updated successfully"
        });
    } catch (error) {
        console.log("error in the change password controller", error.message);
        return res.status(500).json({ message: "internal server error" });
    }
};

// For Google-only accounts adding their first password
export const setPassword = async (req, res) => {
    try {
        const { newPassword } = req.body;

        if (!newPassword || newPassword.length < 6) {
            return res.status(400).json({ message: "Password must be at least 6 characters" });
        }

        const user = await User.findById(req.user._id).select("+password");

        if (user.password) {
            return res.status(400).json({
                message: "This account already has a password. Use change password instead."
            });
        }

        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);
        user.passwordChangedAt = new Date();
        await user.save();

        generateToken(user._id, res);

        return res.status(200).json({
            success: true,
            message: "Password set successfully. You can now log in with email and password too."
        });
    } catch (error) {
        console.log("error in the set password controller", error.message);
        return res.status(500).json({ message: "internal server error" });
    }
};

// =========================
// UPDATE PROFILE
// =========================

export const updateProfile = async (req, res) => {
    try {
        const { fullName } = req.body;

        if (fullName === undefined) {
            return res.status(400).json({
                success: false,
                message: "Nothing to update"
            });
        }

        if (
            typeof fullName !== "string" ||
            !fullName.trim()
        ) {
            return res.status(400).json({
                success: false,
                message: "Full name cannot be empty"
            });
        }

        const updatedUser = await User.findByIdAndUpdate(
            req.user._id,
            {
                fullName: fullName.trim()
            },
            {
                new: true,
                runValidators: true
            }
        ).select("-password");

        if (!updatedUser) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        return res.status(200).json({
            success: true,
            data: updatedUser
        });

    } catch (error) {
        console.error(
            "Error in update profile controller:",
            error.message
        );

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};


// =========================
// REQUEST EMAIL CHANGE
// =========================

export const requestEmailChange = async (req, res) => {
    try {
        const { newEmail, password } = req.body;

        // --------------------------------
        // Validate input
        // --------------------------------

        if (
            typeof newEmail !== "string" ||
            !newEmail.trim()
        ) {
            return res.status(400).json({
                success: false,
                message: "A new email address is required"
            });
        }

        const normalizedEmail =
            normalizeEmail(newEmail);

        if (!isValidEmail(normalizedEmail)) {
            return res.status(400).json({
                success: false,
                message: "Please provide a valid email address"
            });
        }

        // --------------------------------
        // Get current user
        // --------------------------------

        const user = await User.findById(req.user._id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        // --------------------------------
        // Prevent changing to same email
        // --------------------------------

        if (normalizedEmail === user.email) {
            return res.status(400).json({
                success: false,
                message:
                    "The new email must be different from your current email"
            });
        }

        // --------------------------------
        // Require current password
        // --------------------------------

        if (!user.password) {
            return res.status(400).json({
                success: false,
                message:
                    "Google accounts cannot change their email this way"
            });
        }

        if (
            typeof password !== "string" ||
            !password
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Your current password is required"
            });
        }

        const passwordMatches =
            await bcrypt.compare(
                password,
                user.password
            );

        if (!passwordMatches) {
            return res.status(400).json({
                success: false,
                message: "Current password is incorrect"
            });
        }

        // --------------------------------
        // Check whether email is already used
        // --------------------------------

        const existingUser = await User.findOne({
            email: normalizedEmail,
            _id: { $ne: user._id }
        });

        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: "Email is already in use"
            });
        }

        // --------------------------------
        // Generate secure verification token
        // --------------------------------

        const rawToken =
            crypto.randomBytes(32).toString("hex");

        const hashedToken =
            crypto
                .createHash("sha256")
                .update(rawToken)
                .digest("hex");

        // --------------------------------
        // Store pending email
        // --------------------------------

        user.pendingEmail = normalizedEmail;
        user.emailChangeToken = hashedToken;
        user.emailChangeExpires =
            Date.now() + 60 * 60 * 1000;

        await user.save();

        // --------------------------------
        // Create confirmation URL
        // --------------------------------

        const confirmUrl =
            `${process.env.FRONTEND_URL}/confirm-email-change/${rawToken}`;

        // --------------------------------
        // Send verification email
        // --------------------------------

        try {
            await sendEmailChangeVerification(
                normalizedEmail,
                confirmUrl
            );
        } catch (emailError) {
            // Don't leave a pending email change
            // if the email couldn't be sent.

            user.pendingEmail = null;
            user.emailChangeToken = null;
            user.emailChangeExpires = null;

            await user.save();

            throw emailError;
        }

        return res.status(200).json({
            success: true,
            message:
                "A confirmation link has been sent to your new email address"
        });

    } catch (error) {
        console.error(
            "Error in request email change controller:",
            error.message
        );

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};


// =========================
// CONFIRM EMAIL CHANGE
// =========================

export const confirmEmailChange = async (req, res) => {
    try {
        const { token } = req.params;

        // --------------------------------
        // Validate token
        // --------------------------------

        if (
            typeof token !== "string" ||
            !token.trim()
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "This link is invalid or has expired"
            });
        }

        // --------------------------------
        // Hash token
        // --------------------------------

        const hashedToken =
            crypto
                .createHash("sha256")
                .update(token)
                .digest("hex");

        // --------------------------------
        // Find pending email change
        // --------------------------------

        const user = await User.findOne({
            emailChangeToken: hashedToken,
            emailChangeExpires: {
                $gt: Date.now()
            }
        });

        if (!user || !user.pendingEmail) {
            return res.status(400).json({
                success: false,
                message:
                    "This link is invalid or has expired"
            });
        }

        // --------------------------------
        // IMPORTANT:
        // Check again that nobody has claimed
        // this email since the request was made.
        // --------------------------------

        const emailAlreadyUsed = await User.findOne({
            email: user.pendingEmail,
            _id: { $ne: user._id }
        });

        if (emailAlreadyUsed) {
            user.pendingEmail = null;
            user.emailChangeToken = null;
            user.emailChangeExpires = null;

            await user.save();

            return res.status(400).json({
                success: false,
                message:
                    "This email address is no longer available"
            });
        }

        // --------------------------------
        // Update email
        // --------------------------------

        user.email = user.pendingEmail;

        // --------------------------------
        // Clear email-change state
        // --------------------------------

        user.pendingEmail = null;
        user.emailChangeToken = null;
        user.emailChangeExpires = null;

        await user.save();

        return res.status(200).json({
            success: true,
            message:
                "Email address updated successfully"
        });

    } catch (error) {
        // Duplicate email race condition
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message:
                    "This email address is already in use"
            });
        }

        console.error(
            "Error in confirm email change controller:",
            error.message
        );

        return res.status(500).json({
            success: false,
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

export const deleteAccount = async (req, res) => {
    try {
        const { password } = req.body;

        const user = await User.findById(req.user._id).select("+password");

        // Google-only accounts (no password) skip the password confirmation
        if (user.password) {
            if (!password) {
                return res.status(400).json({ message: "Password is required to delete your account" });
            }

            const isCorrect = await bcrypt.compare(password, user.password);
            if (!isCorrect) {
                return res.status(400).json({ message: "Incorrect password" });
            }
        }

        await user.deleteOne();
        res.clearCookie("jwt");

        return res.status(200).json({
            success: true,
            message: "Account deleted"
        });
    } catch (error) {
        console.log("error in the delete account controller", error.message);
        return res.status(500).json({ message: "internal server error" });
    }
};