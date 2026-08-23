import axios from "axios";
import https from "https";

const BASE_URL =
    process.env.MPESA_ENV === "production"
        ? "https://api.safaricom.co.ke"
        : "https://sandbox.safaricom.co.ke";

const httpsAgent = new https.Agent({
    family: 4
});
console.log("Daraja BASE_URL:", BASE_URL);
console.log(
    "Consumer key exists:",
    !!process.env.MPESA_CONSUMER_KEY
);
console.log(
    "Consumer secret exists:",
    !!process.env.MPESA_CONSUMER_SECRET
);
// ============================================
// GET M-PESA ACCESS TOKEN
// ============================================

export const getAccessToken = async () => {
    const consumerKey = process.env.MPESA_CONSUMER_KEY;
    const consumerSecret = process.env.MPESA_CONSUMER_SECRET;

    if (!consumerKey || !consumerSecret) {
        throw new Error(
            "M-Pesa consumer key or consumer secret is missing"
        );
    }

    const auth = Buffer.from(
        `${consumerKey}:${consumerSecret}`
    ).toString("base64");

    const response = await axios.get(
        `${BASE_URL}/oauth/v1/generate?grant_type=client_credentials`,
        {
            headers: {
                Authorization: `Basic ${auth}`
            },
            httpsAgent,
            timeout: 15000
        }
    );

    if (!response.data?.access_token) {
        throw new Error(
            "Failed to obtain M-Pesa access token"
        );
    }

    return response.data.access_token;
};


// ============================================
// GENERATE DARaja TIMESTAMP
// ============================================

const getTimestamp = () => {
    const date = new Date();

    const pad = (value) =>
        value.toString().padStart(2, "0");

    return (
        date.getFullYear().toString() +
        pad(date.getMonth() + 1) +
        pad(date.getDate()) +
        pad(date.getHours()) +
        pad(date.getMinutes()) +
        pad(date.getSeconds())
    );
};


// ============================================
// FORMAT KENYAN PHONE NUMBER
// ============================================

export const formatPhoneNumber = (phone) => {
    if (
        typeof phone !== "string" ||
        !phone.trim()
    ) {
        throw new Error(
            "Phone number is required"
        );
    }

    let formatted = phone
        .trim()
        .replace(/\s+/g, "");

    // Remove leading +
    if (formatted.startsWith("+")) {
        formatted = formatted.slice(1);
    }

    // 07XXXXXXXX / 01XXXXXXXX
    if (formatted.startsWith("0")) {
        formatted = `254${formatted.slice(1)}`;
    }

    // 7XXXXXXXX / 1XXXXXXXX
    else if (
        formatted.startsWith("7") ||
        formatted.startsWith("1")
    ) {
        formatted = `254${formatted}`;
    }

    // Validate final Daraja format
    if (!/^254[17]\d{8}$/.test(formatted)) {
        throw new Error(
            "Invalid Kenyan phone number"
        );
    }

    return formatted;
};


// ============================================
// INITIATE M-PESA STK PUSH
// ============================================

export const initiateSTKPush = async ({
    phone,
    amount,
    accountReference,
    transactionDesc
}) => {

    if (
        amount == null ||
        !Number.isFinite(Number(amount)) ||
        Number(amount) <= 0
    ) {
        throw new Error(
            "Payment amount must be greater than zero"
        );
    }

    if (!accountReference?.trim()) {
        throw new Error(
            "Account reference is required"
        );
    }

    if (!transactionDesc?.trim()) {
        throw new Error(
            "Transaction description is required"
        );
    }

    const accessToken =
        await getAccessToken();

    const timestamp = getTimestamp();

    const shortcode =
        process.env.MPESA_SHORTCODE;

    const passkey =
        process.env.MPESA_PASSKEY;

    const callbackUrl =
        process.env.MPESA_CALLBACK_URL;

    if (
        !shortcode ||
        !passkey ||
        !callbackUrl
    ) {
        throw new Error(
            "M-Pesa shortcode, passkey, or callback URL is missing"
        );
    }

    // Generate password:
    // Base64(BusinessShortCode + Passkey + Timestamp)

    const password = Buffer.from(
        `${shortcode}${passkey}${timestamp}`
    ).toString("base64");

    const formattedPhone =
        formatPhoneNumber(phone);

    const response = await axios.post(
        `${BASE_URL}/mpesa/stkpush/v1/processrequest`,
        {
            BusinessShortCode: process.env.MPESA_SHORTCODE,
            Password: password,
            Timestamp: timestamp,
            TransactionType: "CustomerPayBillOnline",
            Amount: Math.round(amount),
            PartyA: formattedPhone,
            PartyB: process.env.MPESA_SHORTCODE,
            PhoneNumber: formattedPhone,
            CallBackURL: process.env.MPESA_CALLBACK_URL,
            AccountReference: accountReference,
            TransactionDesc: transactionDesc
        },
        {
            headers: {
                Authorization: `Bearer ${accessToken}`
            },
            httpsAgent,
            timeout: 15000
        }
    );

return response.data;
};


// ============================================
// PARSE M-PESA TRANSACTION DATE
// ============================================

export const parseMpesaDate = (raw) => {
    if (raw == null) {
        return null;
    }

    const str = String(raw);

    // Daraja TransactionDate:
    // YYYYMMDDHHmmss

    if (!/^\d{14}$/.test(str)) {
        return null;
    }

    const year = str.slice(0, 4);
    const month = str.slice(4, 6);
    const day = str.slice(6, 8);
    const hour = str.slice(8, 10);
    const minute = str.slice(10, 12);
    const second = str.slice(12, 14);

    const date = new Date(
        `${year}-${month}-${day}T${hour}:${minute}:${second}`
    );

    return Number.isNaN(date.getTime())
        ? null
        : date;
};