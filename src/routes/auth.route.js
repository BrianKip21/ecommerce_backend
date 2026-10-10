import express from "express"
import { authenticate } from "../middleware/authMiiddleware.js"
import { 
    login, 
    signup, 
    getMe, 
    logout, 
    googleAuth, 
    forgotPassword, 
    resetPassword, 
    requestEmailChange,
    changePassword,
    updateProfile,
    setPassword,
    deleteAccount,
    confirmEmailChange
 } from "../controllers/auth/auth.controller.js"
import {
    loginRateLimiter,
    googleAuthRateLimiter,
    requestEmailChangeRateLimiter,
    signupRateLimiter,
    forgotPasswordRateLimiter,
    resetPasswordRateLimiter
} from "../middleware/rateLimitMiddleware.js";

const router= express.Router()

// Public
router.post("/signup", signupRateLimiter, signup);
router.post("/login", loginRateLimiter, login);
router.post("/google", googleAuthRateLimiter, googleAuth);
router.post("/logout", logout);
router.post("/forgot-password", forgotPasswordRateLimiter, forgotPassword);
router.post("/reset-password/:token", resetPasswordRateLimiter, resetPassword);
router.post("/confirm-email-change/:token", confirmEmailChange); // the token itself is the proof

// Authenticated
router.get("/me", authenticate, getMe);
router.patch("/profile", authenticate, updateProfile);
router.patch("/password", authenticate, changePassword);
router.patch("/set-password", authenticate, setPassword);
router.post("/request-email-change", requestEmailChangeRateLimiter,authenticate, requestEmailChange);
router.delete("/account", authenticate, deleteAccount);

export default router