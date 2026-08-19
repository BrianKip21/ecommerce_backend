import express from "express"
import dotenv from "dotenv"
import cookieParser from "cookie-parser"
const app = express()

app.use(express.json())
import { connectDB } from "./lib/db.js";

import authRoutes from "./routes/auth.route.js"

dotenv.config();
const PORT = process.env.PORT

app.use(cookieParser())

app.use("/api/auth", authRoutes)

app.listen(PORT, ()=>{
    console.log("server is running on PORT:" + PORT)
    connectDB();
})