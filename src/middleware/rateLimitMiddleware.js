import rateLimit from "express-rate-limit";


// ======================================================
// GLOBAL RATE LIMITER
// ======================================================
//
// Broad protection for the entire API.
// Specific sensitive routes below have stricter limits.
//

export const globalRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 300,

    standardHeaders: "draft-8",
    legacyHeaders: false,

    message: {
        success: false,
        message:
            "Too many requests from this IP. Please try again later."
    }
});


// ======================================================
// LOGIN
// ======================================================
//
// Protects against brute-force password attacks.
//

export const loginRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,

    standardHeaders: "draft-8",
    legacyHeaders: false,

    message: {
        success: false,
        message:
            "Too many login attempts. Please try again in 15 minutes."
    }
});


// ======================================================
// SIGNUP
// ======================================================
//
// Prevents automated account creation.
//

export const signupRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,

    standardHeaders: "draft-8",
    legacyHeaders: false,

    message: {
        success: false,
        message:
            "Too many signup attempts. Please try again later."
    }
});


// ======================================================
// GOOGLE AUTHENTICATION
// ======================================================
//
// Google login is also an authentication endpoint,
// so it should have its own rate limit.
//

export const googleAuthRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,

    standardHeaders: "draft-8",
    legacyHeaders: false,

    message: {
        success: false,
        message:
            "Too many authentication attempts. Please try again later."
    }
});


// ======================================================
// FORGOT PASSWORD
// ======================================================
//
// This endpoint sends an email, so it gets a stricter
// hourly limit to prevent email abuse.
//

export const forgotPasswordRateLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3,

    standardHeaders: "draft-8",
    legacyHeaders: false,

    message: {
        success: false,
        message:
            "Too many password reset requests. Please try again later."
    }
});


// ======================================================
// RESET PASSWORD
// ======================================================
//
// Protects the endpoint that actually changes the password.
//

export const resetPasswordRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5,

    standardHeaders: "draft-8",
    legacyHeaders: false,

    message: {
        success: false,
        message:
            "Too many password reset attempts. Please try again later."
    }
});


// ======================================================
// REQUEST EMAIL CHANGE
// ======================================================
//
// This endpoint sends a verification email.
// Therefore it needs a strict limit.
//

export const requestEmailChangeRateLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3,

    standardHeaders: "draft-8",
    legacyHeaders: false,

    message: {
        success: false,
        message:
            "Too many email change requests. Please try again later."
    }
});


// ======================================================
// CONFIRM EMAIL CHANGE
// ======================================================
//
// This endpoint verifies the token and changes the email.
// It does NOT require authentication because the user
// may click the verification link while logged out.
//

export const confirmEmailChangeRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,

    standardHeaders: "draft-8",
    legacyHeaders: false,

    message: {
        success: false,
        message:
            "Too many email verification attempts. Please try again later."
    }
});


// ======================================================
// PAYMENT
// ======================================================
//
// Payments are sensitive and should have a tighter limit.
//

export const paymentRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5,

    standardHeaders: "draft-8",
    legacyHeaders: false,

    message: {
        success: false,
        message:
            "Too many payment requests. Please try again later."
    }
});