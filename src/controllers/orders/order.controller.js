import mongoose from "mongoose";
import { StatusCodes } from "http-status-codes";
import Order from "../../models/order.model.js";
import Cart from "../../models/cart.model.js";
import Product from "../../models/product.model.js";
import User from "../../models/user.model.js"

export const placeOrder = async (req, res) => {
    try {
        const {
            addressId,
            shippingAddress,
            saveAddress = false
        } = req.body;

        // ----------------------------------------
        // FIND AUTHENTICATED USER
        // ----------------------------------------

        const user = await User.findById(req.user._id);

        if (!user) {
            return res.status(StatusCodes.UNAUTHORIZED).json({
                message: "User not found"
            });
        }


        // ----------------------------------------
        // RESOLVE SHIPPING ADDRESS
        // ----------------------------------------

        let sanitizedShippingAddress;


        // ========================================
        // OPTION 1: USE SAVED ADDRESS
        // ========================================

        if (addressId) {

            // Validate MongoDB ObjectId
            if (!mongoose.Types.ObjectId.isValid(addressId)) {
                return res.status(StatusCodes.BAD_REQUEST).json({
                    message: "Invalid address id"
                });
            }

            const savedAddress = user.addresses.id(addressId);

            if (!savedAddress) {
                return res.status(StatusCodes.NOT_FOUND).json({
                    message: "Shipping address not found"
                });
            }

            sanitizedShippingAddress = {
                fullName: savedAddress.fullName.trim(),
                phone: savedAddress.phone.trim(),
                address: savedAddress.address.trim(),
                city: savedAddress.city.trim(),
                country: savedAddress.country.trim()
            };

            // Include postal code if your address schema/order schema supports it
            if (savedAddress.postalCode) {
                sanitizedShippingAddress.postalCode =
                    savedAddress.postalCode.trim();
            }
        }


        // ========================================
        // OPTION 2: USE NEW/CUSTOM ADDRESS
        // ========================================

        else if (shippingAddress) {

            const {
                fullName,
                phone,
                address,
                city,
                country,
                postalCode
            } = shippingAddress;


            // ----------------------------------------
            // VALIDATE TYPES
            // ----------------------------------------

            if (
                typeof fullName !== "string" ||
                typeof phone !== "string" ||
                typeof address !== "string" ||
                typeof city !== "string" ||
                typeof country !== "string"
            ) {
                return res.status(StatusCodes.BAD_REQUEST).json({
                    message: "Invalid shipping address"
                });
            }


            // ----------------------------------------
            // SANITIZE ADDRESS
            // ----------------------------------------

            sanitizedShippingAddress = {
                fullName: fullName.trim(),
                phone: phone.trim(),
                address: address.trim(),
                city: city.trim(),
                country: country.trim(),
                postalCode:
                    typeof postalCode === "string"
                        ? postalCode.trim()
                        : undefined
            };


            // ----------------------------------------
            // REQUIRED FIELD VALIDATION
            // ----------------------------------------

            if (
                !sanitizedShippingAddress.fullName ||
                !sanitizedShippingAddress.phone ||
                !sanitizedShippingAddress.address ||
                !sanitizedShippingAddress.city ||
                !sanitizedShippingAddress.country
            ) {
                return res.status(StatusCodes.BAD_REQUEST).json({
                    message:
                        "Full name, phone, address, city and country are required"
                });
            }


            // ----------------------------------------
            // OPTIONALLY SAVE NEW ADDRESS
            // ----------------------------------------

            // ----------------------------------------
            // OPTIONALLY SAVE NEW ADDRESS
            // ----------------------------------------

            if (saveAddress === true) {

                const shouldBeDefault =
                    user.addresses.length === 0;

                user.addresses.push({
                    label: "Home",
                    fullName:
                        sanitizedShippingAddress.fullName,
                    phone:
                        sanitizedShippingAddress.phone,
                    address:
                        sanitizedShippingAddress.address,
                    city:
                        sanitizedShippingAddress.city,
                    country:
                        sanitizedShippingAddress.country,
                    isDefault: shouldBeDefault
                });

                await user.save();
            }
        }


        // ========================================
        // NO ADDRESS PROVIDED
        // ========================================

        else {
            return res.status(StatusCodes.BAD_REQUEST).json({
                message:
                    "Please select a saved address or provide a shipping address"
            });
        }


        // ----------------------------------------
        // FIND USER CART
        // ----------------------------------------

        const cart = await Cart.findOne({
            user: req.user._id
        }).populate(
            "items.product",
            "title image variants"
        );

        if (!cart || cart.items.length === 0) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                message: "Your cart is empty"
            });
        }


        // ----------------------------------------
        // START TRANSACTION
        // ----------------------------------------

        const session = await mongoose.startSession();

        let createdOrder;

        try {

            await session.withTransaction(async () => {

                const orderItems = [];
                let subtotal = 0;


                // ----------------------------------------
                // PROCESS CART ITEMS
                // ----------------------------------------

                for (const item of cart.items) {

                    const product = item.product;

                    if (!product) {
                        throw new Error("PRODUCT_NOT_FOUND");
                    }


                    // ----------------------------------------
                    // FIND SELECTED VARIANT
                    // ----------------------------------------

                    const variant = product.variants.id(
                        item.variantId
                    );

                    if (!variant) {
                        throw new Error("VARIANT_NOT_FOUND");
                    }


                    // ----------------------------------------
                    // DETERMINE PRICE
                    // ----------------------------------------

                    const price =
                        variant.salePrice ?? variant.price;

                    if (
                        price == null ||
                        !Number.isFinite(Number(price)) ||
                        Number(price) < 0
                    ) {
                        throw new Error("INVALID_PRICE");
                    }


                    // ----------------------------------------
                    // RESERVE STOCK
                    // ----------------------------------------

                    const result = await Product.updateOne(
                        {
                            _id: product._id,
                            "variants._id": variant._id,
                            "variants.stock": {
                                $gte: item.quantity
                            }
                        },
                        {
                            $inc: {
                                "variants.$.stock":
                                    -item.quantity
                            }
                        },
                        {
                            session
                        }
                    );


                    // ----------------------------------------
                    // STOCK CHECK
                    // ----------------------------------------

                    if (result.matchedCount === 0) {
                        throw new Error(
                            `OUT_OF_STOCK:${product.title}:${variant.color}:${variant.size}`
                        );
                    }


                    // ----------------------------------------
                    // CREATE ORDER ITEM
                    // ----------------------------------------

                    orderItems.push({
                        product: product._id,

                        variantId: variant._id,

                        title: product.title,

                        image: product.image,

                        sku: variant.sku,

                        size: variant.size,

                        color: variant.color,

                        price: Number(price),

                        quantity: item.quantity
                    });


                    // ----------------------------------------
                    // CALCULATE SUBTOTAL
                    // ----------------------------------------

                    subtotal +=
                        Number(price) * item.quantity;
                }


                // ----------------------------------------
                // CREATE ORDER
                // ----------------------------------------

                const order = new Order({
                    user: req.user._id,

                    items: orderItems,

                    // IMPORTANT:
                    // This is a snapshot of the address
                    // at the time the order was created.
                    shippingAddress:
                        sanitizedShippingAddress,

                    subtotal,

                    total: subtotal,

                    // ----------------------------------------
                    // PAYMENT STATE
                    // ----------------------------------------

                    paymentStatus: "pending",

                    paymentAttempts: 0,

                    paymentLockedUntil: null,

                    paidAt: null,

                    // ----------------------------------------
                    // ORDER STATE
                    // ----------------------------------------

                    status: "pending"
                });


                await order.save({
                    session
                });


                // ----------------------------------------
                // CLEAR CART
                // ----------------------------------------

                cart.items = [];

                await cart.save({
                    session
                });


                createdOrder = order;
            });

        } finally {
            await session.endSession();
        }


        // ----------------------------------------
        // RESPONSE
        // ----------------------------------------

        return res.status(StatusCodes.CREATED).json({
            success: true,
            data: createdOrder
        });


    } catch (error) {

        console.error(
            "Error in place order controller:",
            error.message
        );


        // ----------------------------------------
        // PRODUCT NOT FOUND
        // ----------------------------------------

        if (error.message === "PRODUCT_NOT_FOUND") {
            return res.status(StatusCodes.BAD_REQUEST).json({
                message:
                    "One of the products in your cart no longer exists"
            });
        }


        // ----------------------------------------
        // VARIANT NOT FOUND
        // ----------------------------------------

        if (error.message === "VARIANT_NOT_FOUND") {
            return res.status(StatusCodes.BAD_REQUEST).json({
                message:
                    "One of the variants you selected is no longer available"
            });
        }


        // ----------------------------------------
        // INVALID PRICE
        // ----------------------------------------

        if (error.message === "INVALID_PRICE") {
            return res.status(StatusCodes.BAD_REQUEST).json({
                message:
                    "One of the products in your cart has an invalid price"
            });
        }


        // ----------------------------------------
        // OUT OF STOCK
        // ----------------------------------------

        if (error.message.startsWith("OUT_OF_STOCK:")) {

            const [, title, color, size] =
                error.message.split(":");

            return res.status(StatusCodes.BAD_REQUEST).json({
                message:
                    `Not enough stock for ${title} (${color}, ${size})`
            });
        }


        // ----------------------------------------
        // INTERNAL SERVER ERROR
        // ----------------------------------------

        return res.status(
            StatusCodes.INTERNAL_SERVER_ERROR
        ).json({
            message: "Internal server error"
        });
    }
};


export const getMyOrders = async (req, res) => {
    try {
        const orders = await Order.find({
            user: req.user._id
        }).sort({
            createdAt: -1
        });

        return res.status(StatusCodes.OK).json({
            success: true,
            data: orders
        });

    } catch (error) {
        console.error(
            "Error in get my orders controller:",
            error.message
        );

        return res.status(
            StatusCodes.INTERNAL_SERVER_ERROR
        ).json({
            message: "Internal server error"
        });
    }
};


export const getOrderById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                message: "Invalid order id"
            });
        }

        const order = await Order.findById(id);

        if (!order) {
            return res.status(StatusCodes.NOT_FOUND).json({
                message: "Order not found"
            });
        }

        if (
            req.user.role !== "admin" &&
            order.user.toString() !== req.user._id.toString()
        ) {
            return res.status(StatusCodes.FORBIDDEN).json({
                message:
                    "You are not authorized to view this order"
            });
        }

        return res.status(StatusCodes.OK).json({
            success: true,
            data: order
        });

    } catch (error) {
        console.error(
            "Error in get order by id controller:",
            error.message
        );

        return res.status(
            StatusCodes.INTERNAL_SERVER_ERROR
        ).json({
            message: "Internal server error"
        });
    }
};


export const getAllOrders = async (req, res) => {
    try {
        const orders = await Order.find({})
            .populate("user", "fullName email")
            .sort({
                createdAt: -1
            });

        return res.status(StatusCodes.OK).json({
            success: true,
            data: orders
        });

    } catch (error) {
        console.error(
            "Error in get all orders controller:",
            error.message
        );

        return res.status(
            StatusCodes.INTERNAL_SERVER_ERROR
        ).json({
            message: "Internal server error"
        });
    }
};


export const updateOrderStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const validStatuses = [
            "pending",
            "paid",
            "shipped",
            "delivered",
            "cancelled"
        ];

        if (!status || !validStatuses.includes(status)) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                message:
                    `Status must be one of: ${validStatuses.join(", ")}`
            });
        }

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                message: "Invalid order id"
            });
        }

        const order = await Order.findById(id);

        if (!order) {
            return res.status(StatusCodes.NOT_FOUND).json({
                message: "Order not found"
            });
        }

        /*
         * Prevent changing an order that has already been
         * delivered or cancelled.
         */
        if (
            order.status === "delivered" ||
            order.status === "cancelled"
        ) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                message:
                    `Cannot change status of an order that is already ${order.status}`
            });
        }

        order.status = status;

        await order.save();

        return res.status(StatusCodes.OK).json({
            success: true,
            data: order
        });

    } catch (error) {
        console.error(
            "Error in update order status controller:",
            error.message
        );

        return res.status(
            StatusCodes.INTERNAL_SERVER_ERROR
        ).json({
            message: "Internal server error"
        });
    }
};