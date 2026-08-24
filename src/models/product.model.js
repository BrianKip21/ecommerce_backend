import mongoose from "mongoose";

const variantSchema = new mongoose.Schema({
    sku: {
        type: String,
        unique: true,
        required: true
    },
    size: {
        type: String,
        required: true
    },
    color: {
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
    stock: {
        type: Number,
        required: true,
        min: 0
    }
});

const ProductSchema = new mongoose.Schema({
    image: {
        type: String,
        required: true
    },

    title: {
        type: String,
        required: true,
        trim: true
    },

    description: {
        type: String,
        required: true,
        trim: true
    },

    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category",
        required: true
    },

    brand: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Brand",
        required: true
    },

    variants: {
        type: [variantSchema],
        required: true
    },

    averageReview: {
        type: Number,
        min: 0,
        max: 5,
        default: 0
    },

    reviewCount: {
        type: Number,
        default: 0,
        min: 0
    }
}, {
    timestamps: true
});

ProductSchema.index(
    { title: 1, category: 1, brand: 1 },
    { unique: true }
);

const Product = mongoose.model("Product", ProductSchema);

export default Product;