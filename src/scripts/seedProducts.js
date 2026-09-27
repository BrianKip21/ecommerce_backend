import dotenv from "dotenv";
import mongoose from "mongoose";
import Product from "../models/product.model.js";
import Category from "../models/category.model.js";
import Brand from "../models/brand.model.js";

dotenv.config();

const PRODUCTS_TO_CREATE = 200;

// Test images.
// We're intentionally reusing a few images because this is
// a database/frontend performance test, not an image-upload test.
const testImages = [
    "https://images.unsplash.com/photo-1529139574466-a303027c1d8b",
    "https://images.unsplash.com/photo-1496747611176-843222e1e57c",
    "https://images.unsplash.com/photo-1551488831-00ddcb6c6bd3",
    "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab"
];

const clothingSizes = [
    "XS",
    "S",
    "M",
    "L",
    "XL",
    "XXL"
];

const shoeSizes = [
    "36",
    "37",
    "38",
    "39",
    "40",
    "41",
    "42",
    "43",
    "44",
    "45"
];

const colors = [
    { name: "Black", hex: "#000000" },
    { name: "White", hex: "#FFFFFF" },
    { name: "Blue", hex: "#0000FF" },
    { name: "Brown", hex: "#8B4513" },
    { name: "Green", hex: "#008000" },
    { name: "Red", hex: "#FF0000" },
    { name: "Grey", hex: "#808080" },
    { name: "Beige", hex: "#F5F5DC" }
];

const clothingProducts = [
    "Vintage Denim Jacket",
    "Oversized T-Shirt",
    "Classic Cargo Pants",
    "Vintage Hoodie",
    "Cotton Shirt",
    "Classic Polo Shirt",
    "Vintage Blazer",
    "Linen Shirt",
    "Denim Skirt",
    "Vintage Dress"
];

const shoeProducts = [
    "Classic Sneakers",
    "Vintage Sneakers",
    "Leather Loafers",
    "Casual Boots",
    "Canvas Shoes",
    "Classic Trainers",
    "Leather Boots",
    "Running Shoes"
];

function randomItem(array) {
    return array[Math.floor(Math.random() * array.length)];
}

function createVariant(index, isShoe) {
    const color = randomItem(colors);

    const size = isShoe
        ? randomItem(shoeSizes)
        : randomItem(clothingSizes);

    const price = isShoe
        ? 1500 + Math.floor(Math.random() * 5000)
        : 500 + Math.floor(Math.random() * 3500);

    const hasSale = index % 3 === 0;

    return {
        sku: `TEST-${index}-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
        size,
        color: color.name,
        colorHex: color.hex,
        price,
        salePrice: hasSale ? price - 200 : null,
        stock: Math.floor(Math.random() * 25) + 1
    };
}

async function seedProducts() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);

        console.log("MongoDB connected");

        const categories = await Category.find();
        const brands = await Brand.find();

        if (categories.length === 0) {
            throw new Error(
                "No categories found. Create categories before seeding products."
            );
        }

        if (brands.length === 0) {
            throw new Error(
                "No brands found. Create brands before seeding products."
            );
        }

        const products = [];

        for (let i = 0; i < PRODUCTS_TO_CREATE; i++) {
            // Roughly 25% shoes, 75% clothing
            const isShoe = i % 4 === 0;

            const productName = isShoe
                ? randomItem(shoeProducts)
                : randomItem(clothingProducts);

            const category = categories[i % categories.length];
            const brand = brands[i % brands.length];

            const variants = [
                createVariant(`${i}-1`, isShoe),
                createVariant(`${i}-2`, isShoe)
            ];

            products.push({
                image: testImages[i % testImages.length],

                imagePublicId: `test/products/product-${i + 1}`,

                title: `${productName} ${i + 1}`,

                description: isShoe
                    ? `A stylish pre-owned ${productName.toLowerCase()} available at Liaan Collections.`
                    : `A stylish pre-owned ${productName.toLowerCase()} available at Liaan Collections.`,

                category: category._id,

                brand: brand._id,

                variants,

                averageReview: Number(
                    (3 + Math.random() * 2).toFixed(1)
                ),

                reviewCount: Math.floor(Math.random() * 50)
            });
        }

        const insertedProducts = await Product.insertMany(products);

        console.log(
            `Successfully created ${insertedProducts.length} products.`
        );

        process.exit(0);

    } catch (error) {
        console.error("Product seeding failed:", error);
        process.exit(1);
    }
}

seedProducts();