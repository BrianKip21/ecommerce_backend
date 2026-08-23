import mongoose from "mongoose";
import { StatusCodes } from "http-status-codes";

import Payment from "../../models/payment.model.js";
import Order from "../../models/order.model.js";
import { initiateSTKPush, parseMpesaDate } from "../../lib/mpesa.js";


// ============================================
// PAY FOR ORDER
// ============================================

export const payForOrder = async (req, res) => {
    try {
        const { orderId, phone } = req.body;

        // ----------------------------------------
        // Validate input
        // ----------------------------------------

        if (!orderId || !phone?.trim()) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                message: "Order id and phone number are required"
            });
        }

        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                message: "Invalid order id"
            });
        }

        // ----------------------------------------
        // Normalize phone number
        // ----------------------------------------

        const normalizedPhone = phone.trim();

        // Basic Kenyan phone validation
        if (!/^2547\d{8}$/.test(normalizedPhone)) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                message:
                    "Invalid phone number. Use format 2547XXXXXXXX"
            });
        }

        // ----------------------------------------
        // Find order
        // ----------------------------------------

        const order = await Order.findById(orderId);

        if (!order) {
            return res.status(StatusCodes.NOT_FOUND).json({
                message: "Order not found"
            });
        }

        // ----------------------------------------
        // Verify ownership
        // ----------------------------------------

        if (
            order.user.toString() !==
            req.user._id.toString()
        ) {
            return res.status(StatusCodes.FORBIDDEN).json({
                message:
                    "You are not authorized to pay for this order"
            });
        }

        // ----------------------------------------
        // Make sure order is still payable
        // ----------------------------------------

        if (
            ["shipped", "delivered", "cancelled"].includes(
                order.status
            )
        ) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                message:
                    `This order cannot be paid for because it is already ${order.status}`
            });
        }

        if (
            !["pending", "failed"].includes(
                order.paymentStatus
            )
        ) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                message:
                    `This order cannot be paid for — current payment status is "${order.paymentStatus}"`
            });
        }

        // ----------------------------------------
        // Prevent duplicate pending payments
        // ----------------------------------------

        const existingPendingPayment =
            await Payment.findOne({
                order: order._id,
                status: "pending"
            });

        if (existingPendingPayment) {
            return res.status(StatusCodes.CONFLICT).json({
                message:
                    "A payment is already being processed for this order",
                data: {
                    checkoutRequestId:
                        existingPendingPayment.checkoutRequestId
                }
            });
        }

        // ----------------------------------------
        // Initiate STK Push
        // ----------------------------------------

        const stkResponse = await initiateSTKPush({
            phone: normalizedPhone,
            amount: order.total,
            accountReference: order._id.toString(),
            transactionDesc:
                `Payment for order ${order._id}`
        });

        if (
            !stkResponse ||
            stkResponse.ResponseCode !== "0"
        ) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                message:
                    stkResponse?.ResponseDescription ||
                    "Failed to initiate payment"
            });
        }

        // ----------------------------------------
        // Save payment
        // ----------------------------------------

        const payment = new Payment({
            order: order._id,
            user: req.user._id,
            phone: normalizedPhone,
            amount: order.total,

            merchantRequestId:
                stkResponse.MerchantRequestID,

            checkoutRequestId:
                stkResponse.CheckoutRequestID,

            status: "pending"
        });

        await payment.save();

        // ----------------------------------------
        // Reset failed order payment status
        // ----------------------------------------

        if (order.paymentStatus === "failed") {
            order.paymentStatus = "pending";
            await order.save();
        }

        return res.status(StatusCodes.OK).json({
            success: true,
            data: {
                message:
                    "Payment prompt sent. Check your phone to complete payment.",

                checkoutRequestId:
                    stkResponse.CheckoutRequestID
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
            message: "Internal server error"
        });
    }
};


// ============================================
// M-PESA CALLBACK
// ============================================

export const mpesaCallback = async (req, res) => {
    try {
        const callback =
            req.body?.Body?.stkCallback;

        // ----------------------------------------
        // Invalid callback structure
        // ----------------------------------------

        if (!callback) {
            return res.status(StatusCodes.OK).json({
                ResultCode: 0,
                ResultDesc: "Accepted"
            });
        }

        const {
            CheckoutRequestID,
            ResultCode,
            ResultDesc,
            CallbackMetadata
        } = callback;

        // ----------------------------------------
        // Find payment
        // ----------------------------------------

        const payment = await Payment.findOne({
            checkoutRequestId: CheckoutRequestID
        });

        if (!payment) {
            console.warn(
                "Received callback for unknown checkoutRequestId:",
                CheckoutRequestID
            );

            return res.status(StatusCodes.OK).json({
                ResultCode: 0,
                ResultDesc: "Accepted"
            });
        }

        // ----------------------------------------
        // Idempotency protection
        // ----------------------------------------

        if (payment.status !== "pending") {
            return res.status(StatusCodes.OK).json({
                ResultCode: 0,
                ResultDesc: "Accepted"
            });
        }

        // ----------------------------------------
        // Store M-Pesa result
        // ----------------------------------------

        payment.resultCode = ResultCode;
        payment.resultDescription = ResultDesc;

        // ----------------------------------------
        // PAYMENT SUCCESS
        // ----------------------------------------

        if (ResultCode === 0) {
            const items =
                CallbackMetadata?.Item || [];

            const getMetadataValue = (name) =>
                items.find(
                    (item) => item.Name === name
                )?.Value;

            const receipt =
                getMetadataValue(
                    "MpesaReceiptNumber"
                );

            const rawAmount =
                getMetadataValue("Amount");

            const rawPhone =
                getMetadataValue(
                    "PhoneNumber"
                );

            const rawDate =
                getMetadataValue(
                    "TransactionDate"
                );

            // ----------------------------------------
            // Validate receipt
            // ----------------------------------------

            if (!receipt) {
                console.error(
                    "Successful M-Pesa callback has no receipt:",
                    CheckoutRequestID
                );

                return res.status(
                    StatusCodes.OK
                ).json({
                    ResultCode: 0,
                    ResultDesc: "Accepted"
                });
            }

            // ----------------------------------------
            // Validate amount
            // ----------------------------------------

            if (
                rawAmount == null ||
                Number(rawAmount) !== Number(payment.amount)
            ) {
                console.error(
                    "M-Pesa amount mismatch:",
                    {
                        expected: payment.amount,
                        received: rawAmount,
                        checkoutRequestId:
                            CheckoutRequestID
                    }
                );

                payment.status = "failed";
                payment.resultDescription =
                    "Payment amount mismatch";

                await payment.save();

                return res.status(
                    StatusCodes.OK
                ).json({
                    ResultCode: 0,
                    ResultDesc: "Accepted"
                });
            }

            // ----------------------------------------
            // Parse transaction date
            // ----------------------------------------

            payment.status = "success";

            payment.mpesaReceiptNumber =
                receipt;

            payment.transactionDate =
                rawDate
                    ? parseMpesaDate(rawDate)
                    : new Date();

            // ----------------------------------------
            // Update payment + order atomically
            // ----------------------------------------

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
                            ).session(session);

                        if (!order) {
                            throw new Error(
                                "ORDER_NOT_FOUND"
                            );
                        }

                        // Don't revive a cancelled order
                        if (
                            order.status ===
                            "cancelled"
                        ) {
                            throw new Error(
                                "ORDER_CANCELLED"
                            );
                        }

                        order.paymentStatus =
                            "paid";

                        order.paidAt =
                            new Date();

                        // Payment success moves
                        // order into fulfillment
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

        // ----------------------------------------
        // PAYMENT FAILED
        // ----------------------------------------

        } else {
            payment.status = "failed";

            await payment.save();

            await Order.findByIdAndUpdate(
                payment.order,
                {
                    paymentStatus: "failed"
                }
            );
        }

        // ----------------------------------------
        // Always acknowledge Safaricom
        // ----------------------------------------

        return res.status(StatusCodes.OK).json({
            ResultCode: 0,
            ResultDesc: "Accepted"
        });

    } catch (error) {
        console.error(
            "Error in mpesaCallback:",
            error.message
        );

        // Safaricom should receive 200
        return res.status(StatusCodes.OK).json({
            ResultCode: 0,
            ResultDesc: "Accepted"
        });
    }
};


// ============================================
// GET PAYMENT STATUS
// ============================================

export const getPaymentStatus = async (
    req,
    res
) => {
    try {
        const { checkoutRequestId } =
            req.params;

        if (!checkoutRequestId?.trim()) {
            return res.status(
                StatusCodes.BAD_REQUEST
            ).json({
                message:
                    "Checkout request id is required"
            });
        }

        const payment =
            await Payment.findOne({
                checkoutRequestId
            });

        if (!payment) {
            return res.status(
                StatusCodes.NOT_FOUND
            ).json({
                message: "Payment not found"
            });
        }

        // ----------------------------------------
        // Ownership check
        // ----------------------------------------

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

        return res.status(StatusCodes.OK).json({
            success: true,

            data: {
                status: payment.status,

                amount: payment.amount,

                mpesaReceiptNumber:
                    payment.mpesaReceiptNumber,

                resultCode:
                    payment.resultCode,

                resultDescription:
                    payment.resultDescription,

                transactionDate:
                    payment.transactionDate
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
            message: "Internal server error"
        });
    }
};