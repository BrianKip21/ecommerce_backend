import mongoose from "mongoose";


// ============================================================
// ORDER ITEM
// ============================================================

const orderItemSchema = new mongoose.Schema(
    {
        product: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Product",
            required: true
        },

        variantId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true
        },

        title: {
            type: String,
            required: true,
            trim: true
        },

        image: {
            type: String,
            default: null
        },

        sku: {
            type: String,
            required: true,
            trim: true
        },

        size: {
            type: String,
            required: true,
            trim: true
        },

        color: {
            type: String,
            required: true,
            trim: true
        },

        price: {
            type: Number,
            required: true,
            min: 0
        },

        quantity: {
            type: Number,
            required: true,
            min: 1
        }
    },
    {
        _id: false
    }
);


// ============================================================
// SHIPPING ADDRESS
// ============================================================

const shippingAddressSchema = new mongoose.Schema(
    {
        fullName: {
            type: String,
            required: true,
            trim: true
        },

        phone: {
            type: String,
            required: true,
            trim: true
        },

        address: {
            type: String,
            required: true,
            trim: true
        },

        city: {
            type: String,
            required: true,
            trim: true
        },

        country: {
            type: String,
            required: true,
            trim: true
        },

        postalCode: {
            type: String,
            trim: true,
            default: null
        }
    },
    {
        _id: false
    }
);


// ============================================================
// ORDER
// ============================================================

const orderSchema = new mongoose.Schema(
    {
        // ----------------------------------------------------
        // CUSTOMER
        // ----------------------------------------------------

        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true
        },


        // ----------------------------------------------------
        // ORDER ITEMS
        // ----------------------------------------------------

        items: {
            type: [orderItemSchema],
            required: true,

            validate: {
                validator: function (items) {
                    return items.length > 0;
                },

                message:
                    "An order must contain at least one item"
            }
        },


        // ----------------------------------------------------
        // SHIPPING
        // ----------------------------------------------------

        shippingAddress: {
            type: shippingAddressSchema,
            required: true
        },


        // ----------------------------------------------------
        // PRICING
        // ----------------------------------------------------

        subtotal: {
            type: Number,
            required: true,
            min: 0
        },

        total: {
            type: Number,
            required: true,
            min: 0
        },


        // ====================================================
        // PAYMENT
        // ====================================================

        paymentStatus: {
            type: String,

            enum: [
                "pending",
                "paid",
                "failed",
                "refunded"
            ],

            default: "pending",

            index: true
        },


        /*
         * Number of payment attempts made for this order.
         *
         * Example:
         *
         * Attempt 1
         * Attempt 2
         * Attempt 3
         */
        paymentAttempts: {
            type: Number,

            default: 0,

            min: 0
        },


        /*
         * After 3 failed attempts, the order is temporarily
         * locked from receiving another payment attempt.
         *
         * Example:
         *
         * paymentLockedUntil:
         * 2026-08-29T10:30:00.000Z
         */
        paymentLockedUntil: {
            type: Date,

            default: null,

            index: true
        },


        /*
         * The current payment attempt must be completed
         * before this time.
         *
         * We will set this to:
         *
         * Date.now() + 5 minutes
         *
         * whenever an STK Push is successfully initiated.
         */
        paymentExpiresAt: {
            type: Date,

            default: null,

            index: true
        },


        /*
         * When the order was successfully paid.
         */
        paidAt: {
            type: Date,

            default: null
        },


        // ====================================================
        // ORDER FULFILLMENT STATUS
        // ====================================================

        status: {
            type: String,

            enum: [
                "pending",
                "processing",
                "shipped",
                "delivered",
                "cancelled"
            ],

            default: "pending",

            index: true
        }
    },

    {
        timestamps: true
    }
);


// ============================================================
// INDEXES
// ============================================================

orderSchema.index({
    user: 1,
    createdAt: -1
});

orderSchema.index({
    paymentStatus: 1,
    paymentExpiresAt: 1
});


// ============================================================
// MODEL
// ============================================================

const Order = mongoose.model(
    "Order",
    orderSchema
);

export default Order;
