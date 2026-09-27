import rateLimit from "express-rate-limit";


// ============================================================
// GLOBAL RATE LIMIT
// ============================================================

export const globalRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes

    max: 300, // 300 requests per IP

    standardHeaders: "draft-8",
    legacyHeaders: false,

    message: {
        success: false,
        message:
            "Too many requests from this IP. Please try again later."
    }
});


// ============================================================
// AUTH RATE LIMIT
// ============================================================

export const authRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,

    max: 5,

    standardHeaders: "draft-8",
    legacyHeaders: false,

    message: {
        success: false,
        message:
            "Too many authentication attempts. Please try again later."
    }
});


// ============================================================
// PAYMENT RATE LIMIT
// ============================================================

export const paymentRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,

    max: 5,

    standardHeaders: "draft-8",
    legacyHeaders: false,

    message: {
        success: false,
        message:
            "Too many payment requests. Please try again later."
    }
});