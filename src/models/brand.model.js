import mongoose from "mongoose";

const BrandSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            unique: true,
            trim: true
        },

        description: {
            type: String,
            trim: true
        },

        logo: {
            type: String,
            trim: true
        }
    },
    {
        timestamps: true
    }
);

const Brand = mongoose.model("Brand", BrandSchema);

export default Brand;