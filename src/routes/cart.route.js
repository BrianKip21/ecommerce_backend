import express from "express";
import { optionalAuth } from "../../src/middleware/optionalAuth.middleware.js";
import { resolveCartOwner } from "../../src/middleware/resolveCart.middleware.js";
import {
    getCart,
    addItem,
    updateItemQuantity,
    removeItem,
    clearCart
} from "../../src/controllers/cart/cart.controller.js";

const router = express.Router();

router.use(optionalAuth, resolveCartOwner);

router.get("/", getCart);
router.post("/items", addItem);
router.patch("/items/:itemId", updateItemQuantity);
router.delete("/items/:itemId", removeItem);
router.delete("/", clearCart);

export default router;