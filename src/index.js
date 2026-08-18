import express from "express"
import dotenv from "dotenv"
import cookieParser from "cookie-parser"


dotenv.config();


app.use(express.json())
app.use(cookieParser())