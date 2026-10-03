import mongoose from "mongoose";

const CategorySchema = new mongoose.Schema({
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
    image: {
        type: String,
        default: ""
    },
    imagePublicId: {
        type: String,
        default: ""
    }

}, { timestamps: true })

const Category = mongoose.model("Category", CategorySchema)
export default Category