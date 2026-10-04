import express from "express"
import { authenticate } from "../middleware/authMiiddleware.js"
import { login, signup, getMe, logout, googleAuth } from "../controllers/auth/auth.controller.js"
import { authRateLimiter } from "../middleware/rateLimitMiddleware.js";

const router= express.Router()

router.post('/signup', authRateLimiter, signup)
router.post('/login', authRateLimiter, login)
router.get("/me", authenticate, getMe);
router.post("/logout", logout);
router.post("/google", googleAuth);

export default router