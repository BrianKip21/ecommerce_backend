import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import User from "../models/user.model.js"
import { connectDB } from "../lib/db.js"

dotenv.config();

const seedAdmin = async () => {
    try {
        await connectDB();

        const { ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;

        if (!ADMIN_NAME || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
            throw new Error("Admin environment variables are missing");
        }

        const existingAdmin = await User.findOne({
            email: ADMIN_EMAIL,
        });

        if (existingAdmin) {
            const passwordMatches = await bcrypt.compare(
                ADMIN_PASSWORD,
                existingAdmin.password
            );

            console.log(
                "Does .env password match stored hash?",
                passwordMatches
            );

            process.exit(0);
        }
        const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);

        const admin = await User.create({
            fullName: ADMIN_NAME,
            email: ADMIN_EMAIL,
            password: hashedPassword,
            role: "admin",
        });

        console.log("Admin created successfully", admin.email);
        process.exit(0);
    } catch (error) {
        console.error("Error creating admin:", error);
        process.exit(1);
    }
};

seedAdmin();