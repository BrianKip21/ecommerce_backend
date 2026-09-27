import User from "../../models/user.model.js";
import { generateToken } from "../../lib/utils.js";
import bcrypt from "bcryptjs";
import { mergeGuestCartIntoUser } from "../../services/cart.service.js";

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
        const hashedPassword = await bcrypt.hash(password, salt);

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
export const getMe = async (req, res) => {
    return res.status(200).json({
        _id: req.user._id,
        fullName: req.user.fullName,
        email: req.user.email
    });
};

export const logout = async (req, res) => {
    res.clearCookie("jwt");
    return res.status(200).json({
        success: true,
        message: "Logged out successfully"
    });
};