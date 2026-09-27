import Payment from "../models/payment.model.js";
import Order from "../models/order.model.js";
import Product from "../models/product.model.js";
import mongoose from "mongoose";


// ============================================================
// PAYMENT CONFIGURATION
// ============================================================

const PAYMENT_TIMEOUT_MINUTES = 5;
const MAX_PAYMENT_ATTEMPTS = 3;
const PAYMENT_LOCK_MINUTES = 30;


// ============================================================
// EXPIRE A SINGLE PAYMENT
// ============================================================

const expirePayment = async (payment) => {
    const session = await mongoose.startSession();

    try {
        await session.withTransaction(async () => {

            // ------------------------------------------------
            // Re-check payment inside transaction
            // ------------------------------------------------

            const currentPayment = await Payment.findById(
                payment._id
            ).session(session);

            if (!currentPayment) {
                return;
            }

            // Another process may already have handled it.
            if (currentPayment.status !== "pending") {
                return;
            }

            // ------------------------------------------------
            // Make sure it really has expired
            // ------------------------------------------------

            if (
                !currentPayment.paymentExpiresAt ||
                currentPayment.paymentExpiresAt > new Date()
            ) {
                return;
            }

            // ------------------------------------------------
            // Find associated order
            // ------------------------------------------------

            const order = await Order.findById(
                currentPayment.order
            ).session(session);

            if (!order) {
                console.error(
                    "Payment expiration: order not found:",
                    currentPayment.order
                );

                // We still mark the payment as failed.
                currentPayment.status = "failed";

                currentPayment.resultDescription =
                    "Payment expired";

                await currentPayment.save({
                    session
                });

                return;
            }

            // ------------------------------------------------
            // Don't modify an already-paid order
            // ------------------------------------------------

            if (order.paymentStatus === "paid") {
                currentPayment.status = "success";

                await currentPayment.save({
                    session
                });

                return;
            }

            // ------------------------------------------------
            // Restore reserved stock
            // ------------------------------------------------

            for (const item of order.items) {

                if (!item.product || !item.variantId) {
                    continue;
                }

                await Product.updateOne(
                    {
                        _id: item.product,
                        "variants._id": item.variantId
                    },
                    {
                        $inc: {
                            "variants.$[variant].stock":
                                item.quantity
                        }
                    },
                    {
                        arrayFilters: [
                            {
                                "variant._id":
                                    item.variantId
                            }
                        ],
                        session
                    }
                );
            }

            // ------------------------------------------------
            // Mark payment as failed
            // ------------------------------------------------

            currentPayment.status = "failed";

            currentPayment.resultDescription =
                "Payment expired after 5 minutes";

            currentPayment.resultCode = -1;

            await currentPayment.save({
                session
            });


            // ------------------------------------------------
            // Increment failed payment attempts
            // ------------------------------------------------

            order.paymentAttempts =
                (order.paymentAttempts || 0) + 1;


            // ------------------------------------------------
            // Mark order payment as failed
            // ------------------------------------------------

            order.paymentStatus = "failed";


            // ------------------------------------------------
            // Lock after maximum attempts
            // ------------------------------------------------

            if (
                order.paymentAttempts >=
                MAX_PAYMENT_ATTEMPTS
            ) {
                order.paymentLockedUntil =
                    new Date(
                        Date.now() +
                        PAYMENT_LOCK_MINUTES *
                            60 *
                            1000
                    );
            }


            await order.save({
                session
            });


            console.log(
                `Payment expired: ${currentPayment._id}`
            );

            console.log(
                `Order ${order._id} failed payment attempt ${order.paymentAttempts}/${MAX_PAYMENT_ATTEMPTS}`
            );

            if (order.paymentLockedUntil) {
                console.log(
                    `Order ${order._id} locked until ${order.paymentLockedUntil.toISOString()}`
                );
            }
        });

    } catch (error) {

        console.error(
            `Error expiring payment ${payment._id}:`,
            error.message
        );

        throw error;

    } finally {
        await session.endSession();
    }
};


// ============================================================
// FIND AND EXPIRE PAYMENTS
// ============================================================

export const expirePendingPayments = async () => {
    try {

        const now = new Date();

        const expiredPayments =
            await Payment.find({
                status: "pending",

                paymentExpiresAt: {
                    $lte: now
                }
            }).limit(100);


        if (expiredPayments.length === 0) {
            return;
        }


        console.log(
            `Found ${expiredPayments.length} expired payment(s)`
        );


        for (const payment of expiredPayments) {

            try {
                await expirePayment(payment);

            } catch (error) {

                console.error(
                    `Failed to expire payment ${payment._id}:`,
                    error.message
                );
            }
        }

    } catch (error) {

        console.error(
            "Payment expiration service error:",
            error.message
        );
    }
};


// ============================================================
// START PAYMENT EXPIRATION SERVICE
// ============================================================

export const startPaymentExpirationService = () => {

    console.log(
        `Payment expiration service started`
    );

    console.log(
        `Payment timeout: ${PAYMENT_TIMEOUT_MINUTES} minutes`
    );

    console.log(
        `Maximum attempts: ${MAX_PAYMENT_ATTEMPTS}`
    );

    console.log(
        `Payment lock: ${PAYMENT_LOCK_MINUTES} minutes`
    );


    // Run immediately when server starts.
    expirePendingPayments();


    // Check every 30 seconds.
    const interval = setInterval(
        expirePendingPayments,
        30 * 1000
    );


    // Prevent the interval from keeping Node alive
    // during graceful shutdown.
    if (interval.unref) {
        interval.unref();
    }


    return interval;
};
