import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
    {
        order: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Order",
            required: true,
            index: true
        },

        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true
        },

        // M-Pesa phone number
        phone: {
            type: String,
            required: true,
            trim: true
        },

        // Final amount requested from M-Pesa
        // This should always equal order.total
        amount: {
            type: Number,
            required: true,
            min: 0
        },

        // Returned by Safaricom after STK Push
        merchantRequestId: {
            type: String,
            required: true,
            trim: true
        },

        // Returned by Safaricom after STK Push
        checkoutRequestId: {
            type: String,
            required: true,
            unique: true,
            index: true,
            trim: true
        },

        // Returned in the M-Pesa callback after successful payment
        mpesaReceiptNumber: {
            type: String,
            default: null,
            trim: true
        },

        // M-Pesa result code
        resultCode: {
            type: Number,
            default: null
        },

        // M-Pesa result description
        resultDescription: {
            type: String,
            default: null,
            trim: true
        },

        // Final payment state
        status: {
            type: String,
            enum: ["pending", "success", "failed", "refunded"],
            default: "pending",
            index: true
        },

        // When M-Pesa confirms the transaction
        transactionDate: {
            type: Date,
            default: null
        }
    },
    {
        timestamps: true
    }
);

const Payment = mongoose.model("Payment", paymentSchema);

export default Payment;