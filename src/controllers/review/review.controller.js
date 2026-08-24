import mongoose from "mongoose";
import { StatusCodes } from "http-status-codes";

import Review from "../../models/review.model.js";
import Product from "../../models/product.model.js";
import Order from "../../models/order.model.js";
import { recalculateAverageReview } from "../../lib/review.js";


// ============================================================
// CREATE REVIEW
// ============================================================

export const createReview = async (req, res) => {
    try {
        const { productId, rating, comment } = req.body;

        // Validate product ID
        if (!productId) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                message: "Product id is required"
            });
        }

        if (!mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                message: "Invalid product id"
            });
        }

        // Validate rating
        const numericRating = Number(rating);

        if (
            !Number.isInteger(numericRating) ||
            numericRating < 1 ||
            numericRating > 5
        ) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                message: "Rating must be a whole number between 1 and 5"
            });
        }

        // Validate comment if provided
        if (
            comment !== undefined &&
            comment !== null &&
            typeof comment !== "string"
        ) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                message: "Comment must be a string"
            });
        }

        const trimmedComment = comment?.trim();

        if (trimmedComment && trimmedComment.length > 1000) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                message: "Comment cannot exceed 1000 characters"
            });
        }

        // Check product exists
        const product = await Product.findById(productId);

        if (!product) {
            return res.status(StatusCodes.NOT_FOUND).json({
                message: "Product not found"
            });
        }

        // --------------------------------------------------------
        // VERIFIED PURCHASE CHECK
        // User must have:
        // - paid for the order
        // - received the order
        // - purchased this specific product
        // --------------------------------------------------------

        const qualifyingOrder = await Order.findOne({
            user: req.user._id,
            paymentStatus: "paid",
            status: "delivered",
            "items.product": productId
        });

        if (!qualifyingOrder) {
            return res.status(StatusCodes.FORBIDDEN).json({
                message:
                    "You can only review products you have purchased and received"
            });
        }

        // --------------------------------------------------------
        // ONE REVIEW PER USER PER PRODUCT
        // --------------------------------------------------------

        const existingReview = await Review.findOne({
            product: productId,
            user: req.user._id
        });

        if (existingReview) {
            return res.status(StatusCodes.CONFLICT).json({
                message: "You have already reviewed this product"
            });
        }

        // --------------------------------------------------------
        // CREATE REVIEW
        // --------------------------------------------------------

        const review = await Review.create({
            product: productId,
            user: req.user._id,
            order: qualifyingOrder._id,
            rating: numericRating,
            comment: trimmedComment || undefined
        });

        // Update product rating statistics
        await recalculateAverageReview(productId);

        // Populate user information for response
        await review.populate("user", "fullName");

        return res.status(StatusCodes.CREATED).json({
            success: true,
            data: review
        });

    } catch (error) {
        // Handle duplicate review race condition
        if (error.code === 11000) {
            return res.status(StatusCodes.CONFLICT).json({
                message: "You have already reviewed this product"
            });
        }

        console.error(
            "Error in create review controller:",
            error.message
        );

        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            message: "Internal server error"
        });
    }
};


// ============================================================
// GET PRODUCT REVIEWS
// ============================================================

export const getProductReviews = async (req, res) => {
    try {
        const { productId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                message: "Invalid product id"
            });
        }

        // Make sure product exists
        const productExists = await Product.exists({
            _id: productId
        });

        if (!productExists) {
            return res.status(StatusCodes.NOT_FOUND).json({
                message: "Product not found"
            });
        }

        const reviews = await Review.find({
            product: productId
        })
            .populate("user", "fullName")
            .sort({ createdAt: -1 });

        return res.status(StatusCodes.OK).json({
            success: true,
            count: reviews.length,
            data: reviews
        });

    } catch (error) {
        console.error(
            "Error in get product reviews controller:",
            error.message
        );

        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            message: "Internal server error"
        });
    }
};


// ============================================================
// UPDATE REVIEW
// ============================================================

export const updateReview = async (req, res) => {
    try {
        const { id } = req.params;
        const { rating, comment } = req.body;

        // Validate review ID
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                message: "Invalid review id"
            });
        }

        // Make sure at least one field is being updated
        if (rating === undefined && comment === undefined) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                message: "Rating or comment is required"
            });
        }

        const review = await Review.findById(id);

        if (!review) {
            return res.status(StatusCodes.NOT_FOUND).json({
                message: "Review not found"
            });
        }

        // Only the review owner can edit it
        if (
            review.user.toString() !==
            req.user._id.toString()
        ) {
            return res.status(StatusCodes.FORBIDDEN).json({
                message: "You are not authorized to edit this review"
            });
        }

        // --------------------------------------------------------
        // UPDATE RATING
        // --------------------------------------------------------

        if (rating !== undefined) {
            const numericRating = Number(rating);

            if (
                !Number.isInteger(numericRating) ||
                numericRating < 1 ||
                numericRating > 5
            ) {
                return res.status(StatusCodes.BAD_REQUEST).json({
                    message:
                        "Rating must be a whole number between 1 and 5"
                });
            }

            review.rating = numericRating;
        }

        // --------------------------------------------------------
        // UPDATE COMMENT
        // --------------------------------------------------------

        if (comment !== undefined) {
            if (
                comment !== null &&
                typeof comment !== "string"
            ) {
                return res.status(StatusCodes.BAD_REQUEST).json({
                    message: "Comment must be a string"
                });
            }

            const trimmedComment = comment?.trim();

            if (
                trimmedComment &&
                trimmedComment.length > 1000
            ) {
                return res.status(StatusCodes.BAD_REQUEST).json({
                    message: "Comment cannot exceed 1000 characters"
                });
            }

            review.comment =
                trimmedComment || undefined;
        }

        await review.save();

        // Recalculate product rating
        await recalculateAverageReview(review.product);

        await review.populate("user", "fullName");

        return res.status(StatusCodes.OK).json({
            success: true,
            data: review
        });

    } catch (error) {
        console.error(
            "Error in update review controller:",
            error.message
        );

        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            message: "Internal server error"
        });
    }
};


// ============================================================
// DELETE REVIEW
// ============================================================

export const deleteReview = async (req, res) => {
    try {
        const { id } = req.params;

        // Validate review ID
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                message: "Invalid review id"
            });
        }

        const review = await Review.findById(id);

        if (!review) {
            return res.status(StatusCodes.NOT_FOUND).json({
                message: "Review not found"
            });
        }

        // Owner or admin can delete
        const isOwner =
            review.user.toString() ===
            req.user._id.toString();

        const isAdmin = req.user.role === "admin";

        if (!isOwner && !isAdmin) {
            return res.status(StatusCodes.FORBIDDEN).json({
                message:
                    "You are not authorized to delete this review"
            });
        }

        const productId = review.product;

        await review.deleteOne();

        // Recalculate after deletion
        await recalculateAverageReview(productId);

        return res.status(StatusCodes.OK).json({
            success: true,
            message: "Review deleted successfully"
        });

    } catch (error) {
        console.error(
            "Error in delete review controller:",
            error.message
        );

        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            message: "Internal server error"
        });
    }
};