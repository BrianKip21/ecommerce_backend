import express from "express"
import "dotenv/config";
import cookieParser from "cookie-parser"
const app = express()

app.use(express.json())
import { connectDB } from "./lib/db.js";

import authRoutes from "./routes/auth.route.js"
import productRoutes from './routes/admin/product.route.js'
import categoryRoutes from './routes/admin/category.route.js'
import brandRoutes from './routes/admin/brand.route.js'
import cartRoutes from "./routes/cart.route.js"
import orderRoutes from "./routes/order.route.js"
import paymentRoutes from "./routes/payment.route.js"
import reviewRoutes from "./routes/review.route.js"

const PORT = process.env.PORT

app.use(cookieParser())

app.use("/api/auth", authRoutes)
app.use("/api/v1/product", productRoutes)
app.use("/api/v1/category", categoryRoutes)
app.use("/api/v1/brand", brandRoutes)
app.use("/api/v1/cart", cartRoutes)
app.use("/api/v1/order", orderRoutes)
app.use("/api/v1/payment", paymentRoutes)
app.use("/api/v1/review", reviewRoutes)

app.listen(PORT, ()=>{
    console.log("server is running on PORT:" + PORT)
    connectDB();
})