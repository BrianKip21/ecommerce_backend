import express from "express";
import { authenticate } from "../middleware/authMiiddleware.js";
import { isAdmin } from "../middleware/roleMiddleware.js"

import {
    placeOrder,
    getMyOrders,
    getOrderById,
    getAllOrders,
    updateOrderStatus
} from "../../src/controllers/orders/order.controller.js";

const router = express.Router();

// Customer routes — must be logged in
router.post("/", authenticate, placeOrder);
router.get("/my-orders", authenticate, getMyOrders);
router.get("/:id", authenticate, getOrderById);

// Admin routes
router.get("/", authenticate, isAdmin, getAllOrders);
router.patch("/:id/status", authenticate, isAdmin, updateOrderStatus);

export default router;