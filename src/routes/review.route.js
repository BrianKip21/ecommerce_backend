import express from "express";
import { authenticate } from "../middleware/authMiiddleware.js";
import {
    createReview,
    getProductReviews,
    updateReview,
    deleteReview
} from "../controllers/review/review.controller.js";

const router = express.Router();

router.get("/product/:productId", getProductReviews); // public
router.post("/", authenticate, createReview);
router.patch("/:id", authenticate, updateReview);
router.delete("/:id", authenticate, deleteReview);

export default router;