import mongoose from "mongoose";

const variantSchema = new mongoose.Schema(
    {
        sku: {
            type: String,
            required: true,
            unique: true,
            trim: true
        },

        size: {
            type: String,
            required: true,
            trim: true
        },

        color: {
            type: String,
            required: true,
            trim: true
        },

        colorHex: {
            type: String,
            required: true,
            trim: true
        },

        price: {
            type: Number,
            required: true,
            min: 0
        },

        salePrice: {
            type: Number,
            default: null,
            min: 0,
            validate: {
                validator: function (value) {
                    return value === null || value < this.price;
                },
                message: "Sale price must be less than regular price"
            }
        },

        stock: {
            type: Number,
            required: true,
            min: 0
        }
    },
    { _id: true }
);

const ProductSchema = new mongoose.Schema(
    {
        image: {
            type: String,
            required: true,
            trim: true
        },

        imagePublicId: {
            type: String,
            required: true,
            trim: true
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
            required: true,
            index: true
        },

        brand: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Brand",
            required: true,
            index: true
        },

        variants: {
            type: [variantSchema],
            required: true,
            validate: {
                validator: function (variants) {
                    return variants.length > 0;
                },
                message: "Product must have at least one variant"
            }
        },

        averageReview: {
            type: Number,
            default: 0,
            min: 0,
            max: 5
        },

        reviewCount: {
            type: Number,
            default: 0,
            min: 0
        }
    },
    {
        timestamps: true
    }
);

// Prevent duplicate products with the same title,
// category and brand.
ProductSchema.index(
    { title: 1, category: 1, brand: 1 },
    { unique: true }
);

const Product = mongoose.model("Product", ProductSchema);

export default Product;