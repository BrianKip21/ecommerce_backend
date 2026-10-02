import express from "express";

import { authenticate } from "../middleware/authMiiddleware.js";

import {
    getWishlist,
    toggleWishlistItem,
    removeWishlistItem
} from "../controllers/wishlist/wishlist.controller.js";

const router = express.Router();

// All wishlist routes require authentication
router.use(authenticate);

// Get current user's wishlist
router.get("/", getWishlist);

// Add/remove product from wishlist
router.post("/:productId", toggleWishlistItem);

// Remove product from wishlist
router.delete("/:productId", removeWishlistItem);

export default router;