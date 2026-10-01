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

import {
    buildProductFilter,
    buildSortOption,
    buildPagination
} from "../../lib/productFilters.js";


// ============================================================
// ADD PRODUCT
// ============================================================

export const addProduct = async (req, res) => {
    let uploadedImage = null;

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

        if (
            !mongoose.Types.ObjectId.isValid(category)
        ) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                message: "Invalid category id"
            });
        }

        if (
            !mongoose.Types.ObjectId.isValid(brand)
        ) {
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
                message:
                    "At least one product variant is required"
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

        const existingProduct =
            await Product.findOne({
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
                !/^#[0-9A-Fa-f]{6}$/.test(
                    colorHex.trim()
                )
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
                    numericSalePrice >= numericPrice
                ) {
                    return res.status(
                        StatusCodes.BAD_REQUEST
                    ).json({
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
                return res.status(
                    StatusCodes.BAD_REQUEST
                ).json({
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
                return res.status(
                    StatusCodes.BAD_REQUEST
                ).json({
                    message:
                        `Variant ${color} / ${size} already exists`
                });
            }

            // ----------------------------------------------------
            // GENERATE UNIQUE SKU
            // ----------------------------------------------------

            const sku =
                await generateUniqueSKU();

            processedVariants.push({
                sku,
                size: size.trim(),
                color: color.trim(),
                colorHex:
                    colorHex.trim().toUpperCase(),
                price: numericPrice,
                salePrice: numericSalePrice,
                stock: numericStock
            });
        }

        // --------------------------------------------------------
        // UPLOAD IMAGE
        // --------------------------------------------------------

        uploadedImage =
            await uploadToStorage(
                imageFile.buffer,
                imageFile.originalname,
                "products"
            );

        // --------------------------------------------------------
        // CREATE PRODUCT
        // --------------------------------------------------------

        const newlyCreatedProduct =
            new Product({
                image:
                    uploadedImage.secure_url,

                imagePublicId:
                    uploadedImage.public_id,

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
        // POPULATE PRODUCT
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

        // --------------------------------------------------------
        // RESPONSE
        // --------------------------------------------------------

        return res.status(
            StatusCodes.CREATED
        ).json({
            success: true,
            message:
                "Product created successfully",
            data: populatedProduct
        });

    } catch (error) {

        // --------------------------------------------------------
        // CLEAN UP UPLOADED IMAGE
        // --------------------------------------------------------

        if (uploadedImage?.public_id) {
            try {
                await deleteFromStorage(
                    uploadedImage.public_id
                );
            } catch (cleanupError) {
                console.error(
                    "Failed to clean up uploaded product image:",
                    cleanupError.message
                );
            }
        }

        // --------------------------------------------------------
        // DUPLICATE KEY
        // --------------------------------------------------------

        if (error.code === 11000) {
            return res.status(
                StatusCodes.CONFLICT
            ).json({
                message:
                    "A product with the submitted data already exists"
            });
        }

        // --------------------------------------------------------
        // ERROR
        // --------------------------------------------------------

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
        // --------------------------------------------------------
        // FILTER
        // --------------------------------------------------------

        const filter =
            buildProductFilter(
                req.query,
                res
            );

        if (!filter) {
            return;
        }

        // --------------------------------------------------------
        // SORTING
        // --------------------------------------------------------

        const sortOption =
            buildSortOption(
                req.query.sort
            );

        // --------------------------------------------------------
        // PAGINATION
        // --------------------------------------------------------

        const {
            pageNum,
            limitNum,
            skip
        } = buildPagination(
            req.query.page,
            req.query.limit
        );

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

        // --------------------------------------------------------
        // PAGINATION
        // --------------------------------------------------------

        const totalPages =
            Math.ceil(
                totalCount / limitNum
            );

        // --------------------------------------------------------
        // RESPONSE
        // --------------------------------------------------------

        return res.status(
            StatusCodes.OK
        ).json({
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
    let newUploadedImage = null;

    try {
        const { id } = req.params;

        // --------------------------------------------------------
        // VALIDATE ID
        // --------------------------------------------------------

        if (
            !mongoose.Types.ObjectId.isValid(id)
        ) {
            return res.status(
                StatusCodes.BAD_REQUEST
            ).json({
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
            return res.status(
                StatusCodes.NOT_FOUND
            ).json({
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
            return res.status(
                StatusCodes.BAD_REQUEST
            ).json({
                message:
                    "No fields provided for update"
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
                return res.status(
                    StatusCodes.BAD_REQUEST
                ).json({
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
                return res.status(
                    StatusCodes.BAD_REQUEST
                ).json({
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
                return res.status(
                    StatusCodes.BAD_REQUEST
                ).json({
                    message:
                        "Invalid category id"
                });
            }

            const existingCategory =
                await Category.findById(
                    category
                );

            if (!existingCategory) {
                return res.status(
                    StatusCodes.NOT_FOUND
                ).json({
                    message:
                        "Category not found"
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
                return res.status(
                    StatusCodes.BAD_REQUEST
                ).json({
                    message:
                        "Invalid brand id"
                });
            }

            const existingBrand =
                await Brand.findById(
                    brand
                );

            if (!existingBrand) {
                return res.status(
                    StatusCodes.NOT_FOUND
                ).json({
                    message:
                        "Brand not found"
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
                    finalSKU =
                        sku.trim();

                    // Check whether SKU belongs
                    // to another product
                    const skuOwner =
                        await Product.findOne({
                            "variants.sku":
                                finalSKU,

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

                    // Check duplicate SKU
                    // within this update
                    const duplicateSKU =
                        processedVariants.find(
                            (item) =>
                                item.sku ===
                                finalSKU
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
                        colorHex
                            .trim()
                            .toUpperCase(),
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
        // CHECK DUPLICATE PRODUCT
        // --------------------------------------------------------

        const finalTitle =
            updateFields.title ??
            product.title;

        const finalCategory =
            updateFields.category ??
            product.category;

        const finalBrand =
            updateFields.brand ??
            product.brand;

        const duplicateProduct =
            await Product.findOne({
                title: finalTitle,
                category: finalCategory,
                brand: finalBrand,

                _id: {
                    $ne: id
                }
            });

        if (duplicateProduct) {
            return res.status(
                StatusCodes.CONFLICT
            ).json({
                message:
                    "A product with this name, category and brand already exists"
            });
        }

        // --------------------------------------------------------
        // IMAGE
        // --------------------------------------------------------

        let oldImagePublicId = null;

        if (imageFile) {

            newUploadedImage =
                await uploadToStorage(
                    imageFile.buffer,
                    imageFile.originalname,
                    "products"
                );

            updateFields.image =
                newUploadedImage.secure_url;

            updateFields.imagePublicId =
                newUploadedImage.public_id;

            oldImagePublicId =
                product.imagePublicId;
        }

        // --------------------------------------------------------
        // UPDATE PRODUCT
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

        if (
            oldImagePublicId &&
            newUploadedImage
        ) {
            try {
                await deleteFromStorage(
                    oldImagePublicId
                );
            } catch (storageError) {
                console.error(
                    "Failed to delete old product image:",
                    storageError.message
                );
            }
        }

        // --------------------------------------------------------
        // RESPONSE
        // --------------------------------------------------------

        return res.status(
            StatusCodes.OK
        ).json({
            success: true,
            message:
                "Product updated successfully",
            data: updatedProduct
        });

    } catch (error) {

        // --------------------------------------------------------
        // CLEAN UP NEW IMAGE IF UPDATE FAILED
        // --------------------------------------------------------

        if (newUploadedImage?.public_id) {
            try {
                await deleteFromStorage(
                    newUploadedImage.public_id
                );
            } catch (cleanupError) {
                console.error(
                    "Failed to clean up new product image:",
                    cleanupError.message
                );
            }
        }

        // --------------------------------------------------------
        // DUPLICATE KEY
        // --------------------------------------------------------

        if (error.code === 11000) {
            return res.status(
                StatusCodes.CONFLICT
            ).json({
                message:
                    "A product with the submitted data already exists"
            });
        }

        // --------------------------------------------------------
        // ERROR
        // --------------------------------------------------------

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

        // --------------------------------------------------------
        // VALIDATE ID
        // --------------------------------------------------------

        if (
            !mongoose.Types.ObjectId.isValid(id)
        ) {
            return res.status(
                StatusCodes.BAD_REQUEST
            ).json({
                message:
                    "Invalid product id"
            });
        }

        // --------------------------------------------------------
        // FIND PRODUCT
        // --------------------------------------------------------

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

        // --------------------------------------------------------
        // NOT FOUND
        // --------------------------------------------------------

        if (!product) {
            return res.status(
                StatusCodes.NOT_FOUND
            ).json({
                message:
                    "Product not found"
            });
        }

        // --------------------------------------------------------
        // RESPONSE
        // --------------------------------------------------------

        return res.status(
            StatusCodes.OK
        ).json({
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
            message:
                "Internal server error"
        });
    }
};


// ============================================================
// DELETE PRODUCT
// ============================================================

export const deleteProduct = async (req, res) => {
    try {
        const { id } = req.params;

        // --------------------------------------------------------
        // VALIDATE ID
        // --------------------------------------------------------

        if (
            !mongoose.Types.ObjectId.isValid(id)
        ) {
            return res.status(
                StatusCodes.BAD_REQUEST
            ).json({
                message:
                    "Invalid product id"
            });
        }

        // --------------------------------------------------------
        // FIND PRODUCT
        // --------------------------------------------------------

        const product =
            await Product.findById(id);

        if (!product) {
            return res.status(
                StatusCodes.NOT_FOUND
            ).json({
                message:
                    "Product not found"
            });
        }

        const imagePublicId =
            product.imagePublicId;

        // --------------------------------------------------------
        // DELETE PRODUCT
        // --------------------------------------------------------

        await product.deleteOne();

        // --------------------------------------------------------
        // DELETE IMAGE FROM STORAGE
        // --------------------------------------------------------

        if (imagePublicId) {
            try {
                await deleteFromStorage(
                    imagePublicId
                );
            } catch (storageError) {
                console.error(
                    "Failed to delete product image from storage:",
                    storageError.message
                );
            }
        }

        // --------------------------------------------------------
        // RESPONSE
        // --------------------------------------------------------

        return res.status(
            StatusCodes.OK
        ).json({
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
            message:
                "Internal server error"
        });
    }
};