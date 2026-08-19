import mongoose from "mongoose"

const ProductSchema = new mongoose.Schema({
    image: {
        type: String,
        required: true
    },
    title: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true,
        trim: true
    },
    category: {
        type: String,
        required: true
    },
    brand: {
        type: String,
        required: true
    },
    price: {
        type: Number,
        required: true,
        min: 0
    },
    salePrice: {
        type: Number,
        min: 0,
        default: null
    },
    totalStock: {
        type: Number,
        required: true,
        min: 0,
        default: 0
    },
    averageReview: {
        type: Number,
        min: 0,
        max: 5,
        default: 0
    },
},
 {timestamps: true}
)

const Product = mongoose.model("Product", ProductSchema)
export default Product;