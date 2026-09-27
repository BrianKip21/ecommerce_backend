import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
    {
        // ============================================
        // ORDER
        // ============================================

        order: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Order",
            required: true,
            index: true
        },

        // ============================================
        // USER
        // ============================================

        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true
        },

        // ============================================
        // M-PESA PHONE NUMBER
        // ============================================

        phone: {
            type: String,
            required: true,
            trim: true
        },

        // ============================================
        // PAYMENT AMOUNT
        // ============================================

        amount: {
            type: Number,
            required: true,
            min: 0
        },

        // ============================================
        // PAYMENT ATTEMPT
        // ============================================

        /*
         * Which attempt this payment represents.
         *
         * Example:
         * Attempt 1
         * Attempt 2
         * Attempt 3
         */

        attemptNumber: {
            type: Number,
            required: true,
            min: 1
        },

        // ============================================
        // PAYMENT EXPIRATION
        // ============================================

        /*
         * Every STK payment gets a 5-minute window.
         *
         * Example:
         *
         * createdAt  = 10:00
         * expiresAt  = 10:05
         */

        expiresAt: {
            type: Date,
            required: true,
            index: true
        },

        // ============================================
        // SAFARICOM REQUEST IDs
        // ============================================

        merchantRequestId: {
            type: String,
            required: true,
            trim: true
        },

        checkoutRequestId: {
            type: String,
            required: true,
            unique: true,
            index: true,
            trim: true
        },

        // ============================================
        // M-PESA RECEIPT
        // ============================================

        mpesaReceiptNumber: {
            type: String,
            default: null,
            trim: true
        },

        // ============================================
        // M-PESA RESULT
        // ============================================

        resultCode: {
            type: Number,
            default: null
        },

        resultDescription: {
            type: String,
            default: null,
            trim: true
        },

        // ============================================
        // PAYMENT STATUS
        // ============================================

        status: {
            type: String,
            enum: [
                "pending",
                "success",
                "failed",
                "expired",
                "refunded"
            ],
            default: "pending",
            index: true
        },

        // ============================================
        // TRANSACTION DATE
        // ============================================

        transactionDate: {
            type: Date,
            default: null
        }
    },
    {
        timestamps: true
    }
);


// ============================================
// INDEX FOR EXPIRING PAYMENTS
// ============================================

/*
 * This index helps us find payments whose
 * 5-minute window has expired.
 *
 * IMPORTANT:
 * This does NOT automatically change the
 * payment status to "expired".
 *
 * Our controller will handle that because
 * expiration also needs to update the order
 * and payment-attempt counters.
 */

paymentSchema.index({
    status: 1,
    expiresAt: 1
});


// ============================================
// MODEL
// ============================================

const Payment = mongoose.model(
    "Payment",
    paymentSchema
);

export default Payment;
