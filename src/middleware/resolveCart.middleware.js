import { v4 as uuidv4 } from "uuid";

export const resolveCartOwner = (req, res, next) => {
    if (req.user) {
        req.cartOwner = { user: req.user._id };
        return next();
    }

    let guestId = req.cookies?.guestId;

    if (!guestId) {
        guestId = uuidv4();

        res.cookie("guestId", guestId, {
            maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
            httpOnly: true,
            sameSite: "strict",
            secure: process.env.NODE_ENV === "production"
        });
    }

    req.cartOwner = { guestId };
    next();
};