import express from "express";
import "dotenv/config";
import cookieParser from "cookie-parser";
import { globalRateLimiter } from "./middleware/rateLimitMiddleware.js";
import {
    securityHeaders,
    corsMiddleware
} from "./middleware/securityMiddleware.js";
import {
    startPaymentExpirationService
} from "./services/paymentExpiration.service.js";

import { errorHandler } from "./middleware/errorMiddleware.js";

import { connectDB } from "./lib/db.js";

import authRoutes from "./routes/auth.route.js";
import productRoutes from "./routes/admin/product.route.js";
import categoryRoutes from "./routes/admin/category.route.js";
import brandRoutes from "./routes/admin/brand.route.js";
import collectionRoutes from "./routes/admin/collection.route.js"
import cartRoutes from "./routes/cart.route.js";
import orderRoutes from "./routes/order.route.js";
import paymentRoutes from "./routes/payment.route.js";
import reviewRoutes from "./routes/review.route.js";
import wishlistRoutes from "./routes/wishlist.route.js"

const app = express();

const PORT = process.env.PORT || 5002;

app.set("trust proxy", 1);


app.use(securityHeaders);
app.use(corsMiddleware);

app.use(
    express.json({
        limit: "1mb"
    })
);

app.use(
    express.urlencoded({
        extended: true,
        limit: "1mb"
    })
);
app.use(cookieParser());

app.use(globalRateLimiter);

// ============================================
// ROUTES
// ============================================

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/products", productRoutes);
app.use("/api/v1/categories", categoryRoutes);
app.use("/api/v1/brands", brandRoutes);
app.use("/api/v1/collections", collectionRoutes)
app.use("/api/v1/carts", cartRoutes);
app.use("/api/v1/orders", orderRoutes);
app.use("/api/v1/payments", paymentRoutes);
app.use("/api/v1/reviews", reviewRoutes);
app.use("/api/v1/wishlist", wishlistRoutes);

app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: `Route not found: ${req.method} ${req.originalUrl}`
    });
});

app.use(errorHandler);

app.use(errorHandler);

// ============================================
// START SERVER
// ============================================

const startServer = async () => {
    try {
        await connectDB();

        app.listen(PORT, () => {
            console.log(`Server is running on PORT: ${PORT}`);
            startPaymentExpirationService();
        });
    } catch (error) {
        console.error("Failed to start server:", error.message);
        process.exit(1);
    }
};

startServer();