import express from "express";
import { authenticate } from "../../src/middleware/authMiiddleware.js";
import {
    payForOrder,
    mpesaCallback,
    getPaymentStatus
} from "../controllers/payment/payment.controller.js";

const router = express.Router();

router.post("/pay", authenticate, payForOrder);
router.get("/status/:checkoutRequestId", authenticate, getPaymentStatus);

// Safaricom calls this — no auth
router.post("/callback", mpesaCallback);

export default router;