import jwt from "jsonwebtoken";
import User from "../models/user.model.js";

export const authenticate = async (req, res, next) => {
    try {
        const token = req.cookies.jwt;

        // No JWT cookie
        if (!token) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized"
            });
        }

        // Verify JWT
        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        // Find the user who owns the token
        const user = await User.findById(decoded.userId)
            .select("-password");

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        /*
         * If the user changed their password after this
         * token was created, reject the old token.
         *
         * This logs out old sessions on other devices while
         * allowing the newly issued token to continue working.
         */
        if (user.passwordChangedAt) {
            const changedTimestamp = Math.floor(
                user.passwordChangedAt.getTime() / 1000
            );

            if (decoded.iat < changedTimestamp) {
                return res.status(401).json({
                    success: false,
                    message:
                        "Session expired — please log in again"
                });
            }
        }

        // Attach authenticated user to the request
        req.user = user;

        next();
    } catch (error) {
        console.error(
            "Error in authenticate middleware:",
            error.message
        );

        // JWT-specific errors
        if (error.name === "TokenExpiredError") {
            return res.status(401).json({
                success: false,
                message: "Session expired — please log in again"
            });
        }

        if (error.name === "JsonWebTokenError") {
            return res.status(401).json({
                success: false,
                message: "Unauthorized - Invalid Token"
            });
        }

        // Unexpected server/database error
        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};