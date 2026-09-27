import { StatusCodes } from "http-status-codes";
import mongoose from "mongoose";

import Product from "../../models/product.model.js";
import Category from "../../models/category.model.js";
import Brand from "../../models/brand.model.js";

import { generateUniqueSKU } from "../../lib/sku.js";

import {
    uploadToStorage,
    deleteFromStorage
} from "../../lib/storage.js";


// ============================================================
// ADD PRODUCT
// ============================================================

export const addProduct = async (req, res) => {
    try {
        const {
            title,
            description,
            category,
            brand,
            variants
        } = req.body;

        const imageFile = req.file;

        // --------------------------------------------------------
        // IMAGE
        // --------------------------------------------------------

        if (!imageFile) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                message: "Product image is required"
            });
        }

        // --------------------------------------------------------
        // BASIC VALIDATION
        // --------------------------------------------------------

        if (
            typeof title !== "string" ||
            !title.trim()
        ) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                message: "Product title is required"
            });
        }

        if (
            typeof description !== "string" ||
            !description.trim()
        ) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                message: "Product description is required"
            });
        }

        if (!mongoose.Types.ObjectId.isValid(category)) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                message: "Invalid category id"
            });
        }

        if (!mongoose.Types.ObjectId.isValid(brand)) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                message: "Invalid brand id"
            });
        }

        // --------------------------------------------------------
        // VARIANTS
        // --------------------------------------------------------

        let parsedVariants = variants;

        // multipart/form-data sends variants as a string
        if (typeof parsedVariants === "string") {
            try {
                parsedVariants = JSON.parse(parsedVariants);
            } catch {
                return res.status(StatusCodes.BAD_REQUEST).json({
                    message: "Invalid variants JSON"
                });
            }
        }

        if (
            !Array.isArray(parsedVariants) ||
            parsedVariants.length === 0
        ) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                message: "At least one product variant is required"
            });
        }

        // --------------------------------------------------------
        // CHECK CATEGORY
        // --------------------------------------------------------

        const existingCategory =
            await Category.findById(category);

        if (!existingCategory) {
            return res.status(StatusCodes.NOT_FOUND).json({
                message: "Category not found"
            });
        }

        // --------------------------------------------------------
        // CHECK BRAND
        // --------------------------------------------------------

        const existingBrand =
            await Brand.findById(brand);

        if (!existingBrand) {
            return res.status(StatusCodes.NOT_FOUND).json({
                message: "Brand not found"
            });
        }

        // --------------------------------------------------------
        // CHECK DUPLICATE PRODUCT
        // --------------------------------------------------------

        const existingProduct = await Product.findOne({
            title: title.trim(),
            category,
            brand
        });

        if (existingProduct) {
            return res.status(StatusCodes.CONFLICT).json({
                message:
                    "A product with this name, category and brand already exists"
            });
        }

        // --------------------------------------------------------
        // PROCESS VARIANTS
        // --------------------------------------------------------

        const processedVariants = [];

        for (const variant of parsedVariants) {
            const {
                size,
                color,
                colorHex,
                price,
                salePrice,
                stock
            } = variant;

            // ----------------------------------------------------
            // SIZE
            // ----------------------------------------------------

            if (
                typeof size !== "string" ||
                !size.trim()
            ) {
                return res.status(StatusCodes.BAD_REQUEST).json({
                    message: "Variant size is required"
                });
            }

            // ----------------------------------------------------
            // COLOR
            // ----------------------------------------------------

            if (
                typeof color !== "string" ||
                !color.trim()
            ) {
                return res.status(StatusCodes.BAD_REQUEST).json({
                    message: "Variant color is required"
                });
            }

            // ----------------------------------------------------
            // COLOR HEX
            // ----------------------------------------------------

            if (
                typeof colorHex !== "string" ||
                !/^#[0-9A-Fa-f]{6}$/.test(colorHex.trim())
            ) {
                return res.status(StatusCodes.BAD_REQUEST).json({
                    message:
                        "Variant color must be a valid hex color"
                });
            }

            // ----------------------------------------------------
            // PRICE
            // ----------------------------------------------------

            const numericPrice = Number(price);

            if (
                !Number.isFinite(numericPrice) ||
                numericPrice <= 0
            ) {
                return res.status(StatusCodes.BAD_REQUEST).json({
                    message:
                        "Variant price must be a positive number"
                });
            }

            // ----------------------------------------------------
            // SALE PRICE
            // ----------------------------------------------------

            let numericSalePrice = null;

            if (
                salePrice !== undefined &&
                salePrice !== null &&
                salePrice !== ""
            ) {
                numericSalePrice = Number(salePrice);

                if (
                    !Number.isFinite(numericSalePrice) ||
                    numericSalePrice < 0
                ) {
                    return res.status(StatusCodes.BAD_REQUEST).json({
                        message:
                            "Sale price must be a non-negative number"
                    });
                }

                if (numericSalePrice >= numericPrice) {
                    return res.status(StatusCodes.BAD_REQUEST).json({
                        message:
                            "Sale price must be less than regular price"
                    });
                }
            }

            // ----------------------------------------------------
            // STOCK
            // ----------------------------------------------------

            const numericStock = Number(stock);

            if (
                !Number.isFinite(numericStock) ||
                numericStock < 0
            ) {
                return res.status(StatusCodes.BAD_REQUEST).json({
                    message:
                        "Stock cannot be negative or missing"
                });
            }

            // ----------------------------------------------------
            // DUPLICATE SIZE + COLOR
            // ----------------------------------------------------

            const normalizedSize =
                size.trim().toLowerCase();

            const normalizedColor =
                color.trim().toLowerCase();

            const duplicateVariant =
                processedVariants.find(
                    (item) =>
                        item.size.toLowerCase() ===
                        normalizedSize &&
                        item.color.toLowerCase() ===
                        normalizedColor
                );

            if (duplicateVariant) {
                return res.status(StatusCodes.BAD_REQUEST).json({
                    message:
                        `Variant ${color} / ${size} already exists`
                });
            }

            // ----------------------------------------------------
            // GENERATE UNIQUE SKU
            // ----------------------------------------------------

            const sku = await generateUniqueSKU();

            processedVariants.push({
                sku,
                size: size.trim(),
                color: color.trim(),
                colorHex: colorHex.trim().toUpperCase(),
                price: numericPrice,
                salePrice: numericSalePrice,
                stock: numericStock
            });
        }

        // --------------------------------------------------------
        // UPLOAD IMAGE
        // --------------------------------------------------------

        const uploadedImage =
            await uploadToStorage(
                imageFile.buffer,
                imageFile.originalname
            );

        // --------------------------------------------------------
        // CREATE PRODUCT
        // --------------------------------------------------------

        const newlyCreatedProduct =
            new Product({
                image: uploadedImage.secure_url,
                imagePublicId: uploadedImage.public_id,

                title: title.trim(),
                description: description.trim(),

                category,
                brand,

                variants: processedVariants,

                averageReview: 0,
                reviewCount: 0
            });

        await newlyCreatedProduct.save();

        // --------------------------------------------------------
        // RESPONSE
        // --------------------------------------------------------

        const populatedProduct =
            await Product.findById(
                newlyCreatedProduct._id
            )
                .populate(
                    "category",
                    "name description"
                )
                .populate(
                    "brand",
                    "name description"
                );

        return res.status(StatusCodes.CREATED).json({
            success: true,
            message: "Product created successfully",
            data: populatedProduct
        });

    } catch (error) {
        console.error(
            "Error in add product controller:",
            error
        );

        return res.status(
            StatusCodes.INTERNAL_SERVER_ERROR
        ).json({
            message: "Internal server error"
        });
    }
};


// ============================================================
// GET ALL PRODUCTS
// ============================================================

export const getAllProducts = async (req, res) => {
    try {
        const {
            search,
            category,
            brand,
            minPrice,
            maxPrice,
            size,
            color,
            sort,
            page = 1,
            limit = 20
        } = req.query;

        const filter = {};

        // --------------------------------------------------------
        // SEARCH
        // --------------------------------------------------------

        if (search?.trim()) {
            const searchTerm = search.trim();

            filter.$or = [
                {
                    title: {
                        $regex: searchTerm,
                        $options: "i"
                    }
                },
                {
                    description: {
                        $regex: searchTerm,
                        $options: "i"
                    }
                }
            ];
        }

        // --------------------------------------------------------
        // CATEGORY
        // --------------------------------------------------------

        if (category) {
            if (
                !mongoose.Types.ObjectId.isValid(category)
            ) {
                return res.status(StatusCodes.BAD_REQUEST).json({
                    message: "Invalid category id"
                });
            }

            filter.category = category;
        }

        // --------------------------------------------------------
        // BRAND
        // --------------------------------------------------------

        if (brand) {
            if (
                !mongoose.Types.ObjectId.isValid(brand)
            ) {
                return res.status(StatusCodes.BAD_REQUEST).json({
                    message: "Invalid brand id"
                });
            }

            filter.brand = brand;
        }

        // --------------------------------------------------------
        // PRICE
        // --------------------------------------------------------

        let min;
        let max;

        if (minPrice !== undefined) {
            min = Number(minPrice);

            if (
                !Number.isFinite(min) ||
                min < 0
            ) {
                return res.status(StatusCodes.BAD_REQUEST).json({
                    message:
                        "minPrice must be a valid non-negative number"
                });
            }
        }

        if (maxPrice !== undefined) {
            max = Number(maxPrice);

            if (
                !Number.isFinite(max) ||
                max < 0
            ) {
                return res.status(StatusCodes.BAD_REQUEST).json({
                    message:
                        "maxPrice must be a valid non-negative number"
                });
            }
        }

        if (
            min !== undefined &&
            max !== undefined &&
            min > max
        ) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                message:
                    "minPrice cannot be greater than maxPrice"
            });
        }

        // --------------------------------------------------------
        // VARIANT FILTERS
        // --------------------------------------------------------

        const variantConditions = {};

        if (
            min !== undefined ||
            max !== undefined
        ) {
            variantConditions.price = {};

            if (min !== undefined) {
                variantConditions.price.$gte = min;
            }

            if (max !== undefined) {
                variantConditions.price.$lte = max;
            }
        }

        if (size?.trim()) {
            variantConditions.size = size.trim();
        }

        if (color?.trim()) {
            variantConditions.color = {
                $regex: `^${color.trim()}$`,
                $options: "i"
            };
        }

        if (
            Object.keys(variantConditions).length > 0
        ) {
            filter.variants = {
                $elemMatch: variantConditions
            };
        }

        // --------------------------------------------------------
        // PAGINATION
        // --------------------------------------------------------

        const pageNum = Math.max(
            parseInt(page, 10) || 1,
            1
        );

        const limitNum = Math.min(
            Math.max(
                parseInt(limit, 10) || 20,
                1
            ),
            100
        );

        const skip =
            (pageNum - 1) * limitNum;

        // --------------------------------------------------------
        // SORTING
        // --------------------------------------------------------

        let sortOption = {
            createdAt: -1
        };

        switch (sort) {
            case "oldest":
                sortOption = {
                    createdAt: 1
                };
                break;

            case "price_asc":
                sortOption = {
                    "variants.0.price": 1
                };
                break;

            case "price_desc":
                sortOption = {
                    "variants.0.price": -1
                };
                break;

            case "rating":
                sortOption = {
                    averageReview: -1,
                    createdAt: -1
                };
                break;

            case "most_reviewed":
                sortOption = {
                    reviewCount: -1,
                    createdAt: -1
                };
                break;

            case "newest":
            default:
                sortOption = {
                    createdAt: -1
                };
        }

        // --------------------------------------------------------
        // QUERY
        // --------------------------------------------------------

        const [
            products,
            totalCount
        ] = await Promise.all([
            Product.find(filter)
                .populate(
                    "category",
                    "name description"
                )
                .populate(
                    "brand",
                    "name description"
                )
                .sort(sortOption)
                .skip(skip)
                .limit(limitNum)
                .lean(),

            Product.countDocuments(filter)
        ]);

        const totalPages =
            Math.ceil(
                totalCount / limitNum
            );

        return res.status(StatusCodes.OK).json({
            success: true,
            data: products,

            pagination: {
                page: pageNum,
                limit: limitNum,
                totalCount,
                totalPages,
                hasNextPage:
                    pageNum < totalPages,
                hasPreviousPage:
                    pageNum > 1
            }
        });

    } catch (error) {
        console.error(
            "Error in get all products controller:",
            error
        );

        return res.status(
            StatusCodes.INTERNAL_SERVER_ERROR
        ).json({
            message: "Internal server error"
        });
    }
};


// ============================================================
// EDIT PRODUCT
// ============================================================

export const editProduct = async (req, res) => {
    try {
        const { id } = req.params;

        if (
            !mongoose.Types.ObjectId.isValid(id)
        ) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                message: "Invalid product id"
            });
        }

        let {
            title,
            description,
            category,
            brand,
            variants
        } = req.body;

        const imageFile = req.file;

        // --------------------------------------------------------
        // FIND PRODUCT
        // --------------------------------------------------------

        const product =
            await Product.findById(id);

        if (!product) {
            return res.status(StatusCodes.NOT_FOUND).json({
                message: "Product not found"
            });
        }

        // --------------------------------------------------------
        // CHECK UPDATE
        // --------------------------------------------------------

        if (
            !imageFile &&
            title === undefined &&
            description === undefined &&
            category === undefined &&
            brand === undefined &&
            variants === undefined
        ) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                message: "No fields provided for update"
            });
        }

        const updateFields = {};

        // --------------------------------------------------------
        // TITLE
        // --------------------------------------------------------

        if (title !== undefined) {
            if (
                typeof title !== "string" ||
                !title.trim()
            ) {
                return res.status(StatusCodes.BAD_REQUEST).json({
                    message:
                        "Product title cannot be empty"
                });
            }

            updateFields.title =
                title.trim();
        }

        // --------------------------------------------------------
        // DESCRIPTION
        // --------------------------------------------------------

        if (description !== undefined) {
            if (
                typeof description !== "string" ||
                !description.trim()
            ) {
                return res.status(StatusCodes.BAD_REQUEST).json({
                    message:
                        "Product description cannot be empty"
                });
            }

            updateFields.description =
                description.trim();
        }

        // --------------------------------------------------------
        // CATEGORY
        // --------------------------------------------------------

        if (category !== undefined) {
            if (
                !mongoose.Types.ObjectId.isValid(
                    category
                )
            ) {
                return res.status(StatusCodes.BAD_REQUEST).json({
                    message: "Invalid category id"
                });
            }

            const existingCategory =
                await Category.findById(category);

            if (!existingCategory) {
                return res.status(StatusCodes.NOT_FOUND).json({
                    message: "Category not found"
                });
            }

            updateFields.category =
                category;
        }

        // --------------------------------------------------------
        // BRAND
        // --------------------------------------------------------

        if (brand !== undefined) {
            if (
                !mongoose.Types.ObjectId.isValid(
                    brand
                )
            ) {
                return res.status(StatusCodes.BAD_REQUEST).json({
                    message: "Invalid brand id"
                });
            }

            const existingBrand =
                await Brand.findById(brand);

            if (!existingBrand) {
                return res.status(StatusCodes.NOT_FOUND).json({
                    message: "Brand not found"
                });
            }

            updateFields.brand =
                brand;
        }

        // --------------------------------------------------------
        // VARIANTS
        // --------------------------------------------------------

        if (variants !== undefined) {
            if (typeof variants === "string") {
                try {
                    variants =
                        JSON.parse(variants);
                } catch {
                    return res.status(
                        StatusCodes.BAD_REQUEST
                    ).json({
                        message:
                            "Invalid variants JSON"
                    });
                }
            }

            if (
                !Array.isArray(variants) ||
                variants.length === 0
            ) {
                return res.status(
                    StatusCodes.BAD_REQUEST
                ).json({
                    message:
                        "At least one product variant is required"
                });
            }

            const processedVariants = [];

            for (const variant of variants) {
                const {
                    sku,
                    size,
                    color,
                    colorHex,
                    price,
                    salePrice,
                    stock
                } = variant;

                // ------------------------------------------------
                // SIZE
                // ------------------------------------------------

                if (
                    typeof size !== "string" ||
                    !size.trim()
                ) {
                    return res.status(
                        StatusCodes.BAD_REQUEST
                    ).json({
                        message:
                            "Variant size is required"
                    });
                }

                // ------------------------------------------------
                // COLOR
                // ------------------------------------------------

                if (
                    typeof color !== "string" ||
                    !color.trim()
                ) {
                    return res.status(
                        StatusCodes.BAD_REQUEST
                    ).json({
                        message:
                            "Variant color is required"
                    });
                }

                // ------------------------------------------------
                // COLOR HEX
                // ------------------------------------------------

                if (
                    typeof colorHex !== "string" ||
                    !/^#[0-9A-Fa-f]{6}$/.test(
                        colorHex.trim()
                    )
                ) {
                    return res.status(
                        StatusCodes.BAD_REQUEST
                    ).json({
                        message:
                            "Variant color must be a valid hex color"
                    });
                }

                // ------------------------------------------------
                // PRICE
                // ------------------------------------------------

                const numericPrice =
                    Number(price);

                if (
                    !Number.isFinite(
                        numericPrice
                    ) ||
                    numericPrice <= 0
                ) {
                    return res.status(
                        StatusCodes.BAD_REQUEST
                    ).json({
                        message:
                            "Variant price must be a positive number"
                    });
                }

                // ------------------------------------------------
                // SALE PRICE
                // ------------------------------------------------

                let numericSalePrice = null;

                if (
                    salePrice !== undefined &&
                    salePrice !== null &&
                    salePrice !== ""
                ) {
                    numericSalePrice =
                        Number(salePrice);

                    if (
                        !Number.isFinite(
                            numericSalePrice
                        ) ||
                        numericSalePrice < 0
                    ) {
                        return res.status(
                            StatusCodes.BAD_REQUEST
                        ).json({
                            message:
                                "Sale price must be a non-negative number"
                        });
                    }

                    if (
                        numericSalePrice >=
                        numericPrice
                    ) {
                        return res.status(
                            StatusCodes.BAD_REQUEST
                        ).json({
                            message:
                                "Sale price must be less than regular price"
                        });
                    }
                }

                // ------------------------------------------------
                // STOCK
                // ------------------------------------------------

                const numericStock =
                    Number(stock);

                if (
                    !Number.isFinite(
                        numericStock
                    ) ||
                    numericStock < 0
                ) {
                    return res.status(
                        StatusCodes.BAD_REQUEST
                    ).json({
                        message:
                            "Stock cannot be negative or missing"
                    });
                }

                // ------------------------------------------------
                // DUPLICATE SIZE + COLOR
                // ------------------------------------------------

                const normalizedSize =
                    size.trim().toLowerCase();

                const normalizedColor =
                    color.trim().toLowerCase();

                const duplicateVariant =
                    processedVariants.find(
                        (item) =>
                            item.size
                                .toLowerCase() ===
                            normalizedSize &&
                            item.color
                                .toLowerCase() ===
                            normalizedColor
                    );

                if (duplicateVariant) {
                    return res.status(
                        StatusCodes.BAD_REQUEST
                    ).json({
                        message:
                            `Variant ${color} / ${size} already exists`
                    });
                }

                // ------------------------------------------------
                // SKU
                // ------------------------------------------------

                let finalSKU;

                if (
                    typeof sku === "string" &&
                    sku.trim()
                ) {
                    finalSKU = sku.trim();

                    // Check whether the SKU already belongs
                    // to another product.
                    const skuOwner =
                        await Product.findOne({
                            "variants.sku": finalSKU,
                            _id: {
                                $ne: id
                            }
                        });

                    if (skuOwner) {
                        return res.status(
                            StatusCodes.CONFLICT
                        ).json({
                            message:
                                `SKU ${finalSKU} already belongs to another product`
                        });
                    }

                    // Also prevent duplicate SKU values
                    // within this product update.
                    const duplicateSKU =
                        processedVariants.find(
                            (item) =>
                                item.sku === finalSKU
                        );

                    if (duplicateSKU) {
                        return res.status(
                            StatusCodes.BAD_REQUEST
                        ).json({
                            message:
                                `SKU ${finalSKU} is duplicated`
                        });
                    }
                } else {
                    finalSKU =
                        await generateUniqueSKU();
                }

                processedVariants.push({
                    sku: finalSKU,
                    size: size.trim(),
                    color: color.trim(),
                    colorHex:
                        colorHex.trim().toUpperCase(),
                    price: numericPrice,
                    salePrice:
                        numericSalePrice,
                    stock: numericStock
                });
            }

            updateFields.variants =
                processedVariants;
        }

        // --------------------------------------------------------
        // IMAGE
        // --------------------------------------------------------

        let oldImagePublicId = null;

        if (imageFile) {
            const uploadedImage =
                await uploadToStorage(
                    imageFile.buffer,
                    imageFile.originalname
                );

            updateFields.image =
                uploadedImage.secure_url;

            updateFields.imagePublicId =
                uploadedImage.public_id;

            oldImagePublicId =
                product.imagePublicId;
        }

        // --------------------------------------------------------
        // UPDATE
        // --------------------------------------------------------

        const updatedProduct =
            await Product.findByIdAndUpdate(
                id,
                updateFields,
                {
                    new: true,
                    runValidators: true
                }
            )
                .populate(
                    "category",
                    "name description"
                )
                .populate(
                    "brand",
                    "name description"
                );

        // --------------------------------------------------------
        // DELETE OLD IMAGE
        // --------------------------------------------------------

        if (oldImagePublicId) {
            try {
                await deleteFromStorage(
                    oldImagePublicId
                );
            } catch (cloudinaryError) {
                console.error(
                    "Failed to delete old Cloudinary image:",
                    cloudinaryError.message
                );
            }
        }

        return res.status(StatusCodes.OK).json({
            success: true,
            message:
                "Product updated successfully",
            data: updatedProduct
        });

    } catch (error) {
        console.error(
            "Error in edit product controller:",
            error
        );

        return res.status(
            StatusCodes.INTERNAL_SERVER_ERROR
        ).json({
            message: "Internal server error"
        });
    }
};


// ============================================================
// GET PRODUCT BY ID
// ============================================================

export const getProductById = async (req, res) => {
    try {
        const { id } = req.params;

        if (
            !mongoose.Types.ObjectId.isValid(id)
        ) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                message: "Invalid product id"
            });
        }

        const product =
            await Product.findById(id)
                .populate(
                    "category",
                    "name description"
                )
                .populate(
                    "brand",
                    "name description"
                );

        if (!product) {
            return res.status(StatusCodes.NOT_FOUND).json({
                message: "Product not found"
            });
        }

        return res.status(StatusCodes.OK).json({
            success: true,
            data: product
        });

    } catch (error) {
        console.error(
            "Error in get product by id controller:",
            error
        );

        return res.status(
            StatusCodes.INTERNAL_SERVER_ERROR
        ).json({
            message: "Internal server error"
        });
    }
};


// ============================================================
// DELETE PRODUCT
// ============================================================

export const deleteProduct = async (req, res) => {
    try {
        const { id } = req.params;

        if (
            !mongoose.Types.ObjectId.isValid(id)
        ) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                message: "Invalid product id"
            });
        }

        const product =
            await Product.findById(id);

        if (!product) {
            return res.status(StatusCodes.NOT_FOUND).json({
                message: "Product not found"
            });
        }

        const imagePublicId =
            product.imagePublicId;

        // --------------------------------------------------------
        // DELETE PRODUCT FROM DATABASE
        // --------------------------------------------------------

        await product.deleteOne();

        // --------------------------------------------------------
        // DELETE IMAGE FROM CLOUDINARY
        // --------------------------------------------------------

        if (imagePublicId) {
            try {
                await deleteFromStorage(
                    imagePublicId
                );
            } catch (cloudinaryError) {
                console.error(
                    "Failed to delete product image from Cloudinary:",
                    cloudinaryError.message
                );
            }
        }

        return res.status(StatusCodes.OK).json({
            success: true,
            message:
                "Product deleted successfully"
        });

    } catch (error) {
        console.error(
            "Error in delete product controller:",
            error
        );

        return res.status(
            StatusCodes.INTERNAL_SERVER_ERROR
        ).json({
            message: "Internal server error"
        });
    }
};
