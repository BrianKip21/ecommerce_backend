import mongoose from "mongoose";
import { StatusCodes } from "http-status-codes";

import Payment from "../../models/payment.model.js";
import Order from "../../models/order.model.js";
import {
    initiateSTKPush,
    parseMpesaDate
} from "../../lib/mpesa.js";


// ============================================================
// PAYMENT SETTINGS
// ============================================================

const PAYMENT_EXPIRY_MINUTES = 5;
const MAX_PAYMENT_ATTEMPTS = 3;
const PAYMENT_LOCK_MINUTES = 30;


// ============================================================
// HELPER: GET PAYMENT EXPIRATION DATE
// ============================================================

const getPaymentExpiryDate = () => {
    return new Date(
        Date.now() +
        PAYMENT_EXPIRY_MINUTES * 60 * 1000
    );
};


// ============================================================
// HELPER: GET LOCK EXPIRATION DATE
// ============================================================

const getLockExpiryDate = () => {
    return new Date(
        Date.now() +
        PAYMENT_LOCK_MINUTES * 60 * 1000
    );
};


// ============================================================
// HELPER: GET REMAINING MINUTES
// ============================================================

const getRemainingMinutes = (date) => {
    if (!date) {
        return 0;
    }

    const remaining =
        new Date(date).getTime() - Date.now();

    return Math.max(
        0,
        Math.ceil(remaining / 60000)
    );
};


// ============================================================
// HELPER: EXPIRE PAYMENT
// ============================================================

const expirePaymentIfNecessary = async (payment) => {

    if (
        payment.status !== "pending" ||
        !payment.expiresAt
    ) {
        return payment;
    }

    if (
        new Date(payment.expiresAt).getTime() >
        Date.now()
    ) {
        return payment;
    }

    // ----------------------------------------
    // Mark payment as expired
    // ----------------------------------------

    payment.status = "expired";
    payment.resultDescription =
        "Payment window expired";

    await payment.save();

    // ----------------------------------------
    // Update order
    // ----------------------------------------

    const order = await Order.findById(
        payment.order
    );

    if (!order) {
        return payment;
    }

    // Only update if this payment attempt
    // was still the active payment attempt.
    if (order.paymentStatus === "pending") {

        order.paymentStatus = "failed";

        // Do not exceed maximum attempts.
        if (
            order.paymentAttempts <
            MAX_PAYMENT_ATTEMPTS
        ) {
            order.paymentAttempts += 1;
        }

        // ------------------------------------
        // Lock after maximum attempts
        // ------------------------------------

        if (
            order.paymentAttempts >=
            MAX_PAYMENT_ATTEMPTS
        ) {
            order.paymentLockedUntil =
                getLockExpiryDate();
        }

        await order.save();
    }

    return payment;
};


// ============================================================
// PAY FOR ORDER
// ============================================================

export const payForOrder = async (req, res) => {

    try {

        const {
            orderId,
            phone
        } = req.body;


        // ====================================================
        // VALIDATE INPUT
        // ====================================================

        if (
            !orderId ||
            !phone?.trim()
        ) {

            return res.status(
                StatusCodes.BAD_REQUEST
            ).json({
                message:
                    "Order id and phone number are required"
            });
        }


        if (
            !mongoose.Types.ObjectId.isValid(
                orderId
            )
        ) {

            return res.status(
                StatusCodes.BAD_REQUEST
            ).json({
                message:
                    "Invalid order id"
            });
        }


        // ====================================================
        // NORMALIZE PHONE
        // ====================================================

        const normalizedPhone =
            phone.trim();


        if (
            !/^2547\d{8}$/.test(
                normalizedPhone
            )
        ) {

            return res.status(
                StatusCodes.BAD_REQUEST
            ).json({
                message:
                    "Invalid phone number. Use format 2547XXXXXXXX"
            });
        }


        // ====================================================
        // FIND ORDER
        // ====================================================

        const order =
            await Order.findById(orderId);


        if (!order) {

            return res.status(
                StatusCodes.NOT_FOUND
            ).json({
                message:
                    "Order not found"
            });
        }


        // ====================================================
        // VERIFY OWNERSHIP
        // ====================================================

        if (
            order.user.toString() !==
            req.user._id.toString()
        ) {

            return res.status(
                StatusCodes.FORBIDDEN
            ).json({
                message:
                    "You are not authorized to pay for this order"
            });
        }


        // ====================================================
        // ORDER STATUS
        // ====================================================

        if (
            [
                "shipped",
                "delivered",
                "cancelled"
            ].includes(order.status)
        ) {

            return res.status(
                StatusCodes.BAD_REQUEST
            ).json({
                message:
                    `This order cannot be paid for because it is already ${order.status}`
            });
        }


        // ====================================================
        // ALREADY PAID
        // ====================================================

        if (
            order.paymentStatus === "paid"
        ) {

            return res.status(
                StatusCodes.BAD_REQUEST
            ).json({
                message:
                    "This order has already been paid for"
            });
        }


        // ====================================================
        // CHECK PAYMENT LOCK
        // ====================================================

        if (
            order.paymentLockedUntil
        ) {

            const lockTime =
                new Date(
                    order.paymentLockedUntil
                ).getTime();

            if (
                lockTime > Date.now()
            ) {

                const remainingMinutes =
                    getRemainingMinutes(
                        order.paymentLockedUntil
                    );

                return res.status(
                    StatusCodes.TOO_MANY_REQUESTS
                ).json({
                    message:
                        `Too many failed payment attempts. Try again in ${remainingMinutes} minute${remainingMinutes === 1 ? "" : "s"}.`,
                    data: {
                        lockedUntil:
                            order.paymentLockedUntil,
                        remainingMinutes
                    }
                });

            }

            // --------------------------------------------
            // Lock has expired
            // --------------------------------------------

            order.paymentLockedUntil = null;
            order.paymentAttempts = 0;
            order.paymentStatus = "pending";

            await order.save();
        }


        // ====================================================
        // EXPIRE ANY OLD PENDING PAYMENT
        // ====================================================

        const existingPendingPayment =
            await Payment.findOne({
                order: order._id,
                status: "pending"
            });

        if (existingPendingPayment) {

            await expirePaymentIfNecessary(
                existingPendingPayment
            );

            // --------------------------------------------
            // Re-check status after expiration
            // --------------------------------------------

            if (
                existingPendingPayment.status ===
                "pending"
            ) {

                const remainingSeconds =
                    Math.max(
                        0,
                        Math.ceil(
                            (
                                new Date(
                                    existingPendingPayment.expiresAt
                                ).getTime() -
                                Date.now()
                            ) / 1000
                        )
                    );

                return res.status(
                    StatusCodes.CONFLICT
                ).json({
                    message:
                        "A payment is already being processed for this order",
                    data: {
                        checkoutRequestId:
                            existingPendingPayment.checkoutRequestId,
                        expiresAt:
                            existingPendingPayment.expiresAt,
                        remainingSeconds
                    }
                });
            }
        }


        // ====================================================
        // CHECK MAX ATTEMPTS
        // ====================================================

        if (
            order.paymentAttempts >=
            MAX_PAYMENT_ATTEMPTS
        ) {

            order.paymentLockedUntil =
                getLockExpiryDate();

            await order.save();

            const remainingMinutes =
                getRemainingMinutes(
                    order.paymentLockedUntil
                );

            return res.status(
                StatusCodes.TOO_MANY_REQUESTS
            ).json({
                message:
                    `You have reached the maximum of ${MAX_PAYMENT_ATTEMPTS} payment attempts. Try again in ${remainingMinutes} minutes.`,
                data: {
                    lockedUntil:
                        order.paymentLockedUntil,
                    remainingMinutes
                }
            });
        }


        // ====================================================
        // DETERMINE ATTEMPT NUMBER
        // ====================================================

        const attemptNumber =
            order.paymentAttempts + 1;


        // ====================================================
        // INITIATE STK PUSH
        // ====================================================

        let stkResponse;

        try {

            stkResponse =
                await initiateSTKPush({
                    phone: normalizedPhone,
                    amount: order.total,
                    accountReference:
                        order._id.toString(),
                    transactionDesc:
                        `Payment for order ${order._id}`
                });

        } catch (error) {

            console.error(
                "M-Pesa STK initiation error:",
                error?.response?.data ||
                error.message
            );

            return res.status(
                StatusCodes.BAD_GATEWAY
            ).json({
                message:
                    "Unable to connect to M-Pesa. Please try again shortly."
            });
        }


        // ====================================================
        // VALIDATE STK RESPONSE
        // ====================================================

        if (
            !stkResponse ||
            stkResponse.ResponseCode !== "0"
        ) {

            return res.status(
                StatusCodes.BAD_REQUEST
            ).json({
                message:
                    stkResponse?.ResponseDescription ||
                    "Failed to initiate payment"
            });
        }


        // ====================================================
        // CREATE PAYMENT RECORD
        // ====================================================

        const expiresAt =
            getPaymentExpiryDate();

        const payment =
            new Payment({

                order: order._id,

                user: req.user._id,

                phone:
                    normalizedPhone,

                amount:
                    order.total,

                attemptNumber,

                expiresAt,

                merchantRequestId:
                    stkResponse.MerchantRequestID,

                checkoutRequestId:
                    stkResponse.CheckoutRequestID,

                status:
                    "pending"
            });


        await payment.save();


        // ====================================================
        // COUNT THIS ATTEMPT
        // ====================================================

        order.paymentAttempts =
            attemptNumber;

        order.paymentStatus =
            "pending";

        await order.save();


        // ====================================================
        // RESPONSE
        // ====================================================

        return res.status(
            StatusCodes.OK
        ).json({

            success: true,

            data: {

                message:
                    "Payment prompt sent. Check your phone to complete payment.",

                checkoutRequestId:
                    stkResponse.CheckoutRequestID,

                attemptNumber,

                maxAttempts:
                    MAX_PAYMENT_ATTEMPTS,

                expiresAt,

                expiresInSeconds:
                    PAYMENT_EXPIRY_MINUTES *
                    60
            }
        });

    } catch (error) {

        console.error(
            "Error in payForOrder:",
            error?.response?.data ||
            error.message
        );

        return res.status(
            StatusCodes.INTERNAL_SERVER_ERROR
        ).json({
            message:
                "Internal server error"
        });
    }
};


// ============================================================
// M-PESA CALLBACK
// ============================================================

export const mpesaCallback = async (
    req,
    res
) => {

    try {

        const callback =
            req.body?.Body?.stkCallback;


        // ====================================================
        // INVALID CALLBACK
        // ====================================================

        if (!callback) {

            return res.status(
                StatusCodes.OK
            ).json({
                ResultCode: 0,
                ResultDesc:
                    "Accepted"
            });
        }


        const {
            CheckoutRequestID,
            ResultCode,
            ResultDesc,
            CallbackMetadata
        } = callback;


        // ====================================================
        // FIND PAYMENT
        // ====================================================

        const payment =
            await Payment.findOne({
                checkoutRequestId:
                    CheckoutRequestID
            });


        if (!payment) {

            console.warn(
                "Received callback for unknown checkoutRequestId:",
                CheckoutRequestID
            );

            return res.status(
                StatusCodes.OK
            ).json({
                ResultCode: 0,
                ResultDesc:
                    "Accepted"
            });
        }


        // ====================================================
        // IDEMPOTENCY
        // ====================================================

        if (
            payment.status !== "pending"
        ) {

            return res.status(
                StatusCodes.OK
            ).json({
                ResultCode: 0,
                ResultDesc:
                    "Accepted"
            });
        }


        // ====================================================
        // CHECK EXPIRATION
        // ====================================================

        if (
            payment.expiresAt &&
            new Date(
                payment.expiresAt
            ).getTime() <= Date.now()
        ) {

            payment.status =
                "expired";

            payment.resultCode =
                ResultCode;

            payment.resultDescription =
                "Payment window expired";

            await payment.save();


            const expiredOrder =
                await Order.findById(
                    payment.order
                );


            if (
                expiredOrder &&
                expiredOrder.paymentStatus !==
                    "paid"
            ) {

                expiredOrder.paymentStatus =
                    "failed";

                if (
                    expiredOrder.paymentAttempts <
                    MAX_PAYMENT_ATTEMPTS
                ) {
                    expiredOrder.paymentAttempts += 1;
                }

                if (
                    expiredOrder.paymentAttempts >=
                    MAX_PAYMENT_ATTEMPTS
                ) {

                    expiredOrder.paymentLockedUntil =
                        getLockExpiryDate();
                }

                await expiredOrder.save();
            }


            return res.status(
                StatusCodes.OK
            ).json({
                ResultCode: 0,
                ResultDesc:
                    "Accepted"
            });
        }


        // ====================================================
        // STORE RESULT
        // ====================================================

        payment.resultCode =
            ResultCode;

        payment.resultDescription =
            ResultDesc;


        // ====================================================
        // SUCCESS
        // ====================================================

        if (
            ResultCode === 0
        ) {

            const items =
                CallbackMetadata?.Item ||
                [];


            const getMetadataValue =
                (name) =>
                    items.find(
                        item =>
                            item.Name === name
                    )?.Value;


            const receipt =
                getMetadataValue(
                    "MpesaReceiptNumber"
                );

            const rawAmount =
                getMetadataValue(
                    "Amount"
                );

            const rawPhone =
                getMetadataValue(
                    "PhoneNumber"
                );

            const rawDate =
                getMetadataValue(
                    "TransactionDate"
                );


            // =================================================
            // VALIDATE RECEIPT
            // =================================================

            if (!receipt) {

                console.error(
                    "Successful M-Pesa callback has no receipt:",
                    CheckoutRequestID
                );

                return res.status(
                    StatusCodes.OK
                ).json({
                    ResultCode: 0,
                    ResultDesc:
                        "Accepted"
                });
            }


            // =================================================
            // VALIDATE AMOUNT
            // =================================================

            if (
                rawAmount == null ||
                Number(rawAmount) !==
                    Number(payment.amount)
            ) {

                console.error(
                    "M-Pesa amount mismatch:",
                    {
                        expected:
                            payment.amount,

                        received:
                            rawAmount,

                        checkoutRequestId:
                            CheckoutRequestID
                    }
                );


                payment.status =
                    "failed";

                payment.resultDescription =
                    "Payment amount mismatch";

                await payment.save();


                const mismatchOrder =
                    await Order.findById(
                        payment.order
                    );


                if (
                    mismatchOrder &&
                    mismatchOrder.paymentStatus !==
                        "paid"
                ) {

                    mismatchOrder.paymentStatus =
                        "failed";

                    if (
                        mismatchOrder.paymentAttempts <
                        MAX_PAYMENT_ATTEMPTS
                    ) {

                        mismatchOrder.paymentAttempts +=
                            1;
                    }


                    if (
                        mismatchOrder.paymentAttempts >=
                        MAX_PAYMENT_ATTEMPTS
                    ) {

                        mismatchOrder.paymentLockedUntil =
                            getLockExpiryDate();
                    }


                    await mismatchOrder.save();
                }


                return res.status(
                    StatusCodes.OK
                ).json({
                    ResultCode: 0,
                    ResultDesc:
                        "Accepted"
                });
            }


            // =================================================
            // SUCCESS DATA
            // =================================================

            payment.status =
                "success";

            payment.mpesaReceiptNumber =
                receipt;

            payment.transactionDate =
                rawDate
                    ? parseMpesaDate(
                        rawDate
                    )
                    : new Date();


            // =================================================
            // ATOMIC UPDATE
            // =================================================

            const session =
                await mongoose.startSession();

            try {

                await session.withTransaction(
                    async () => {

                        await payment.save({
                            session
                        });


                        const order =
                            await Order.findById(
                                payment.order
                            ).session(
                                session
                            );


                        if (!order) {
                            throw new Error(
                                "ORDER_NOT_FOUND"
                            );
                        }


                        // ------------------------------------
                        // Do not revive cancelled orders
                        // ------------------------------------

                        if (
                            order.status ===
                            "cancelled"
                        ) {

                            throw new Error(
                                "ORDER_CANCELLED"
                            );
                        }


                        // ------------------------------------
                        // Mark order paid
                        // ------------------------------------

                        order.paymentStatus =
                            "paid";

                        order.paidAt =
                            new Date();

                        // ------------------------------------
                        // Payment succeeded, therefore
                        // attempts/lock are no longer relevant
                        // ------------------------------------

                        order.paymentLockedUntil =
                            null;

                        // ------------------------------------
                        // Move into fulfillment
                        // ------------------------------------

                        if (
                            order.status ===
                            "pending"
                        ) {

                            order.status =
                                "processing";
                        }


                        await order.save({
                            session
                        });
                    }
                );

            } finally {

                await session.endSession();
            }


        // ====================================================
        // FAILED PAYMENT
        // ====================================================

        } else {

            payment.status =
                "failed";

            await payment.save();


            const failedOrder =
                await Order.findById(
                    payment.order
                );


            if (
                failedOrder &&
                failedOrder.paymentStatus !==
                    "paid"
            ) {

                failedOrder.paymentStatus =
                    "failed";


                // --------------------------------------------
                // Count failed attempt
                // --------------------------------------------

                if (
                    failedOrder.paymentAttempts <
                    MAX_PAYMENT_ATTEMPTS
                ) {

                    failedOrder.paymentAttempts +=
                        1;
                }


                // --------------------------------------------
                // Lock after 3 failures
                // --------------------------------------------

                if (
                    failedOrder.paymentAttempts >=
                    MAX_PAYMENT_ATTEMPTS
                ) {

                    failedOrder.paymentLockedUntil =
                        getLockExpiryDate();
                }


                await failedOrder.save();
            }
        }


        // ====================================================
        // ACKNOWLEDGE SAFARICOM
        // ====================================================

        return res.status(
            StatusCodes.OK
        ).json({
            ResultCode: 0,
            ResultDesc:
                "Accepted"
        });

    } catch (error) {

        console.error(
            "Error in mpesaCallback:",
            error.message
        );


        // Safaricom should receive 200.
        return res.status(
            StatusCodes.OK
        ).json({
            ResultCode: 0,
            ResultDesc:
                "Accepted"
        });
    }
};


// ============================================================
// GET PAYMENT STATUS
// ============================================================

export const getPaymentStatus = async (
    req,
    res
) => {

    try {

        const {
            checkoutRequestId
        } = req.params;


        // ====================================================
        // VALIDATE ID
        // ====================================================

        if (
            !checkoutRequestId?.trim()
        ) {

            return res.status(
                StatusCodes.BAD_REQUEST
            ).json({
                message:
                    "Checkout request id is required"
            });
        }


        // ====================================================
        // FIND PAYMENT
        // ====================================================

        let payment =
            await Payment.findOne({
                checkoutRequestId
            });


        if (!payment) {

            return res.status(
                StatusCodes.NOT_FOUND
            ).json({
                message:
                    "Payment not found"
            });
        }


        // ====================================================
        // OWNERSHIP
        // ====================================================

        if (
            payment.user.toString() !==
            req.user._id.toString()
        ) {

            return res.status(
                StatusCodes.FORBIDDEN
            ).json({
                message:
                    "You are not authorized to view this payment"
            });
        }


        // ====================================================
        // EXPIRE PAYMENT IF NECESSARY
        // ====================================================

        payment =
            await expirePaymentIfNecessary(
                payment
            );


        // ====================================================
        // GET ORDER
        // ====================================================

        const order =
            await Order.findById(
                payment.order
            ).select(
                "paymentStatus paymentAttempts paymentLockedUntil"
            );


        // ====================================================
        // RESPONSE
        // ====================================================

        let remainingSeconds = 0;

        if (
            payment.status ===
            "pending" &&
            payment.expiresAt
        ) {

            remainingSeconds =
                Math.max(
                    0,
                    Math.ceil(
                        (
                            new Date(
                                payment.expiresAt
                            ).getTime() -
                            Date.now()
                        ) / 1000
                    )
                );
        }


        return res.status(
            StatusCodes.OK
        ).json({

            success: true,

            data: {

                status:
                    payment.status,

                amount:
                    payment.amount,

                attemptNumber:
                    payment.attemptNumber,

                maxAttempts:
                    MAX_PAYMENT_ATTEMPTS,

                expiresAt:
                    payment.expiresAt,

                remainingSeconds,

                mpesaReceiptNumber:
                    payment.mpesaReceiptNumber,

                resultCode:
                    payment.resultCode,

                resultDescription:
                    payment.resultDescription,

                transactionDate:
                    payment.transactionDate,

                orderPaymentStatus:
                    order?.paymentStatus,

                paymentAttempts:
                    order?.paymentAttempts ?? 0,

                paymentLockedUntil:
                    order?.paymentLockedUntil ?? null,

                isLocked:
                    Boolean(
                        order?.paymentLockedUntil &&
                        new Date(
                            order.paymentLockedUntil
                        ).getTime() >
                            Date.now()
                    )
            }
        });

    } catch (error) {

        console.error(
            "Error in getPaymentStatus:",
            error.message
        );

        return res.status(
            StatusCodes.INTERNAL_SERVER_ERROR
        ).json({
            message:
                "Internal server error"
        });
    }
};
