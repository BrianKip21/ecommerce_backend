import mongoose from "mongoose";
import { StatusCodes } from "http-status-codes";

import Wishlist from "../../models/wishlist.model.js";
import Product from "../../models/product.model.js";


// GET /api/v1/wishlist
export const getWishlist = async (req, res) => {
    try {
        const wishlist = await Wishlist.findOne({
            user: req.user._id
        }).populate(
            "items.product",
            "title image variants averageReview reviewCount"
        );

        // User does not have a wishlist yet
        if (!wishlist) {
            return res.status(StatusCodes.OK).json({
                success: true,
                data: {
                    items: [],
                    itemCount: 0
                }
            });
        }

        // Remove wishlist items whose products no longer exist
        const items = wishlist.items
            .filter((item) => item.product)
            .sort((a, b) => b.addedAt - a.addedAt);

        return res.status(StatusCodes.OK).json({
            success: true,
            data: {
                items,
                itemCount: items.length
            }
        });

    } catch (error) {
        console.error(
            "Error getting wishlist:",
            error.message
        );

        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: "Internal server error"
        });
    }
};


// POST /api/v1/wishlist/:productId
// Toggles a product in/out of the wishlist
export const toggleWishlistItem = async (req, res) => {
    try {
        const { productId } = req.params;

        // Validate MongoDB ObjectId
        if (!mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                success: false,
                message: "Invalid product id"
            });
        }

        // Make sure the product actually exists
        const product = await Product.exists({
            _id: productId
        });

        if (!product) {
            return res.status(StatusCodes.NOT_FOUND).json({
                success: false,
                message: "Product not found"
            });
        }

        let wishlist = await Wishlist.findOne({
            user: req.user._id
        });

        // Create wishlist if the user doesn't have one
        if (!wishlist) {
            wishlist = new Wishlist({
                user: req.user._id,
                items: []
            });
        }

        const existingIndex = wishlist.items.findIndex(
            (item) =>
                item.product.toString() === productId
        );

        let wishlisted;

        if (existingIndex !== -1) {
            // Remove product
            wishlist.items.splice(existingIndex, 1);
            wishlisted = false;
        } else {
            // Add product
            wishlist.items.push({
                product: productId
            });
            wishlisted = true;
        }

        await wishlist.save();

        return res.status(StatusCodes.OK).json({
            success: true,
            data: {
                wishlisted,
                itemCount: wishlist.items.length
            }
        });

    } catch (error) {
        console.error(
            "Error toggling wishlist item:",
            error.message
        );

        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: "Internal server error"
        });
    }
};


// DELETE /api/v1/wishlist/:productId
export const removeWishlistItem = async (req, res) => {
    try {
        const { productId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                success: false,
                message: "Invalid product id"
            });
        }

        const wishlist = await Wishlist.findOne({
            user: req.user._id
        });

        if (!wishlist) {
            return res.status(StatusCodes.OK).json({
                success: true,
                data: {
                    itemCount: 0
                }
            });
        }

        const originalLength = wishlist.items.length;

        wishlist.items = wishlist.items.filter(
            (item) =>
                item.product.toString() !== productId
        );

        // Nothing was removed
        if (wishlist.items.length === originalLength) {
            return res.status(StatusCodes.OK).json({
                success: true,
                data: {
                    itemCount: wishlist.items.length
                }
            });
        }

        await wishlist.save();

        return res.status(StatusCodes.OK).json({
            success: true,
            data: {
                itemCount: wishlist.items.length
            }
        });

    } catch (error) {
        console.error(
            "Error removing wishlist item:",
            error.message
        );

        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: "Internal server error"
        });
    }
};