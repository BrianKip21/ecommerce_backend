import express from "express";

import {
    payForOrder,
    mpesaCallback,
    getPaymentStatus
} from "../controllers/payment/payment.controller.js";

import { authenticate } from "../middleware/authMiiddleware.js";
import { paymentRateLimiter } from "../middleware/rateLimitMiddleware.js";

const router = express.Router();

// ============================================================
// INITIATE PAYMENT
// ============================================================

router.post(
    "/pay",
    authenticate,
    paymentRateLimiter,
    payForOrder
);

// ============================================================
// CHECK PAYMENT STATUS
// ============================================================

router.get(
    "/status/:checkoutRequestId",
    authenticate,
    getPaymentStatus
);

// ============================================================
// M-PESA CALLBACK
// ============================================================

// Safaricom calls this endpoint.
// DO NOT add authenticate middleware here.
router.post(
    "/callback",
    mpesaCallback
);

export default router;