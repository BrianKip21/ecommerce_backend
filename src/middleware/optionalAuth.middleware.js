import jwt from "jsonwebtoken";
import User from "../models/user.model.js";

export const optionalAuth = async (req, res, next) => {
    try {
        const token = req.cookies?.jwt;

        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const user = await User.findById(decoded.userId).select("-password");

            if (user) {
                req.user = user;
            }
        }

        next();

    } catch (error) {
        console.error("Optional authentication error:", error.message);
        next();
    }
};