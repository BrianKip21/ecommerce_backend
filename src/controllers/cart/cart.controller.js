import { StatusCodes } from "http-status-codes";
import Cart from "../../models/cart.model.js";
import Product from "../../models/product.model.js";

const formatCart = (cart) => {
    if (!cart) {
        return {
            items: [],
            total: 0
        };
    }

    let total = 0;

    const items = cart.items.map((item) => {
        const variant = item.product?.variants?.id(item.variantId);

        const price = variant
            ? (variant.salePrice ?? variant.price)
            : null;

        const lineTotal = price !== null
            ? price * item.quantity
            : 0;

        total += lineTotal;

        return {
            _id: item._id,

            product: item.product
                ? {
                    _id: item.product._id,
                    title: item.product.title,
                    image: item.product.image
                }
                : null,

            variant: variant || null,
            quantity: item.quantity,
            lineTotal,

            available: variant
                ? variant.stock >= item.quantity
                : false
        };
    });

    return {
        items,
        total
    };
};


export const getCart = async (req, res) => {
    try {
        const cart = await Cart.findOne(req.cartOwner)
            .populate("items.product", "title image variants");

        const data = formatCart(cart);

        return res.status(StatusCodes.OK).json({
            success: true,
            data
        });

    } catch (error) {
        console.error(
            "Error in get cart controller:",
            error.message
        );

        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: "Internal server error"
        });
    }
};


export const addItem = async (req, res) => {
    try {
        const { productId, variantId, quantity } = req.body;

        if (!productId) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                success: false,
                message: "Product id is required"
            });
        }

        if (!variantId) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                success: false,
                message: "Variant id is required"
            });
        }

        const parsedQuantity = Number(quantity);

        if (!Number.isInteger(parsedQuantity) || parsedQuantity < 1) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                success: false,
                message: "Quantity must be a positive whole number"
            });
        }

        const product = await Product.findById(productId);

        if (!product) {
            return res.status(StatusCodes.NOT_FOUND).json({
                success: false,
                message: "Product not found"
            });
        }

        const variant = product.variants.id(variantId);

        if (!variant) {
            return res.status(StatusCodes.NOT_FOUND).json({
                success: false,
                message: "Variant not found"
            });
        }

        if (variant.stock < 1) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                success: false,
                message: "This variant is out of stock"
            });
        }

        let cart = await Cart.findOne(req.cartOwner);

        if (!cart) {
            cart = new Cart({
                ...req.cartOwner,
                items: []
            });
        }

        const existingItem = cart.items.find(
            (item) =>
                item.product.toString() === productId &&
                item.variantId.toString() === variantId
        );

        const newQuantity = existingItem
            ? existingItem.quantity + parsedQuantity
            : parsedQuantity;

        if (newQuantity > variant.stock) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                success: false,
                message: `Only ${variant.stock} left in stock`
            });
        }

        if (existingItem) {
            existingItem.quantity = newQuantity;
        } else {
            cart.items.push({
                product: productId,
                variantId,
                sku: variant.sku,
                quantity: parsedQuantity
            });
        }

        await cart.save();

        await cart.populate(
            "items.product",
            "title image variants"
        );

        const data = formatCart(cart);

        return res.status(StatusCodes.OK).json({
            success: true,
            data
        });

    } catch (error) {
        console.error(
            "Error in add item to cart controller:",
            error.message
        );

        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: "Internal server error"
        });
    }
};


export const updateItemQuantity = async (req, res) => {
    try {
        const { itemId } = req.params;
        const parsedQuantity = Number(req.body.quantity);

        if (!Number.isInteger(parsedQuantity) || parsedQuantity < 1) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                success: false,
                message: "Quantity must be a positive whole number"
            });
        }

        const cart = await Cart.findOne(req.cartOwner)
            .populate("items.product", "title image variants");

        if (!cart) {
            return res.status(StatusCodes.NOT_FOUND).json({
                success: false,
                message: "Cart not found"
            });
        }

        const item = cart.items.id(itemId);

        if (!item) {
            return res.status(StatusCodes.NOT_FOUND).json({
                success: false,
                message: "Item not found in cart"
            });
        }

        const variant = item.product?.variants?.id(item.variantId);

        if (!variant) {
            return res.status(StatusCodes.NOT_FOUND).json({
                success: false,
                message: "Variant no longer exists"
            });
        }

        if (parsedQuantity > variant.stock) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                success: false,
                message: `Only ${variant.stock} left in stock`
            });
        }

        item.quantity = parsedQuantity;

        await cart.save();

        const data = formatCart(cart);

        return res.status(StatusCodes.OK).json({
            success: true,
            data
        });

    } catch (error) {
        console.error(
            "Error in update cart item controller:",
            error.message
        );

        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: "Internal server error"
        });
    }
};


export const removeItem = async (req, res) => {
    try {
        const { itemId } = req.params;

        const cart = await Cart.findOne(req.cartOwner)
            .populate("items.product", "title image variants");

        if (!cart) {
            return res.status(StatusCodes.NOT_FOUND).json({
                success: false,
                message: "Cart not found"
            });
        }

        const item = cart.items.id(itemId);

        if (!item) {
            return res.status(StatusCodes.NOT_FOUND).json({
                success: false,
                message: "Item not found in cart"
            });
        }

        item.deleteOne();

        await cart.save();

        const data = formatCart(cart);

        return res.status(StatusCodes.OK).json({
            success: true,
            data
        });

    } catch (error) {
        console.error(
            "Error in remove cart item controller:",
            error.message
        );

        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: "Internal server error"
        });
    }
};


export const clearCart = async (req, res) => {
    try {
        const cart = await Cart.findOne(req.cartOwner);

        if (!cart) {
            return res.status(StatusCodes.OK).json({
                success: true,
                data: {
                    items: [],
                    total: 0
                }
            });
        }

        cart.items = [];

        await cart.save();

        return res.status(StatusCodes.OK).json({
            success: true,
            data: {
                items: [],
                total: 0
            }
        });

    } catch (error) {
        console.error(
            "Error in clear cart controller:",
            error.message
        );

        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: "Internal server error"
        });
    }
};