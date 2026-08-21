import Product from "../../models/product.model.js"
import Category from "../../models/category.model.js"
import Brand from "../../models/brand.model.js"

export const addProduct = async (req, res) => {
    try {
        const {
            image,
            title,
            description,
            category,
            brand,
            variants
        } = req.body;

        // Product validation
        if (!image?.trim()) {
            return res.status(400).json({
                message: "Product image must be provided"
            });
        }

        if (!title?.trim()) {
            return res.status(400).json({
                message: "Product title is required"
            });
        }

        if (!description?.trim()) {
            return res.status(400).json({
                message: "Product description is required"
            });
        }

        if (!category) {
            return res.status(400).json({
                message: "Product category is required"
            });
        }

        if (!brand) {
            return res.status(400).json({
                message: "Product brand is required"
            });
        }

        const existingProduct = await Product.findOne({
            title: title.trim(),
            category,
            brand
        });

        if (existingProduct) {
            return res.status(409).json({
                message: "A product with this name, category and brand already exists"
            });
        }
        if (!Array.isArray(variants) || variants.length === 0) {
            return res.status(400).json({
                message: "At least one product variant is required"
            });
        }

        // Check category
        const existingCategory = await Category.findById(category);

        if (!existingCategory) {
            return res.status(404).json({
                message: "Category not found"
            });
        }

        // Check brand
        const existingBrand = await Brand.findById(brand);

        if (!existingBrand) {
            return res.status(404).json({
                message: "Brand not found"
            });
        }

        // Validate variants
        const processedVariants = [];

        for (const variant of variants) {

            const { size, color, price, salePrice, stock } = variant;

            if (!size?.trim()) {
                return res.status(400).json({
                    message: "Variant size is required"
                });
            }

            if (!color?.trim()) {
                return res.status(400).json({
                    message: "Variant color is required"
                });
            }

            if (price === undefined || isNaN(price) || price <= 0) {
                return res.status(400).json({
                    message: "Variant price must be a positive number"
                });
            }

            if (salePrice !== undefined && salePrice !== null) {

                if (isNaN(salePrice) || salePrice < 0) {
                    return res.status(400).json({
                        message: "Sale price must be a non-negative number"
                    });
                }

                if (salePrice >= price) {
                    return res.status(400).json({
                        message: "Sale price must be less than regular price"
                    });
                }
            }

            if (stock === undefined || isNaN(stock) || stock < 0) {
                return res.status(400).json({
                    message: "Stock cannot be negative or missing"
                });
            }

            // Prevent duplicate size + color combinations
            const duplicateVariant = processedVariants.find(
                (item) =>
                    item.size.toLowerCase() === size.trim().toLowerCase() &&
                    item.color.toLowerCase() === color.trim().toLowerCase()
            );

            if (duplicateVariant) {
                return res.status(400).json({
                    message: `Variant ${color} / ${size} already exists`
                });
            }

            // Generate SKU
            const randomPart = Math.random()
                .toString(36)
                .substring(2, 8)
                .toUpperCase();

            const sku = `SKU-${randomPart}`;

            processedVariants.push({
                sku,
                size: size.trim(),
                color: color.trim(),
                price,
                salePrice: salePrice ?? null,
                stock
            });
        }

        // Create product
        const newlyCreatedProduct = new Product({
            image: image.trim(),
            title: title.trim(),
            description: description.trim(),
            category,
            brand,
            variants: processedVariants
        });

        await newlyCreatedProduct.save();

        const populatedProduct = await Product.findById(newlyCreatedProduct._id)
            .populate("category", "name")
            .populate("brand", "name");

        return res.status(201).json({
            success: true,
            data: populatedProduct
        });

    } catch (error) {
        console.log(
            "error in the product add controller",
            error.message
        );

        return res.status(500).json({
            message: "internal server error"
        });
    }
};

export const getAllProducts = async (req, res) => {
    try {
        const productsList = await Product.find({})
            .populate("category", "name description")
            .populate("brand", "name description");

        return res.status(200).json({
            success: true,
            data: productsList
        });

    } catch (error) {
        console.log(
            "error in the get all products controller",
            error.message
        );

        return res.status(500).json({
            message: "internal server error"
        });
    }
};

export const editProduct = async (req, res) => {
    try {
        const { id } = req.params;

        const {
            image,
            title,
            description,
            category,
            brand,
            variants
        } = req.body;

        if (Object.keys(req.body).length === 0) {
            return res.status(400).json({
                message: "No fields provided for update"
            });
        }

        const updateFields = {};

        // Image
        if (image !== undefined) {
            if (!image.trim()) {
                return res.status(400).json({
                    message: "Product image cannot be empty"
                });
            }

            updateFields.image = image.trim();
        }

        // Title
        if (title !== undefined) {
            if (!title.trim()) {
                return res.status(400).json({
                    message: "Product title cannot be empty"
                });
            }

            updateFields.title = title.trim();
        }

        // Description
        if (description !== undefined) {
            if (!description.trim()) {
                return res.status(400).json({
                    message: "Product description cannot be empty"
                });
            }

            updateFields.description = description.trim();
        }

        // Category
        if (category !== undefined) {
            const existingCategory = await Category.findById(category);

            if (!existingCategory) {
                return res.status(404).json({
                    message: "Category not found"
                });
            }

            updateFields.category = category;
        }

        // Brand
        if (brand !== undefined) {
            const existingBrand = await Brand.findById(brand);

            if (!existingBrand) {
                return res.status(404).json({
                    message: "Brand not found"
                });
            }

            updateFields.brand = brand;
        }

        // Variants
        if (variants !== undefined) {

            if (!Array.isArray(variants) || variants.length === 0) {
                return res.status(400).json({
                    message: "At least one product variant is required"
                });
            }

            const processedVariants = [];

            for (const variant of variants) {

                const {
                    sku,
                    size,
                    color,
                    price,
                    salePrice,
                    stock
                } = variant;

                if (!size?.trim()) {
                    return res.status(400).json({
                        message: "Variant size is required"
                    });
                }

                if (!color?.trim()) {
                    return res.status(400).json({
                        message: "Variant color is required"
                    });
                }

                if (price === undefined || isNaN(price) || price <= 0) {
                    return res.status(400).json({
                        message: "Variant price must be a positive number"
                    });
                }

                if (salePrice !== undefined && salePrice !== null) {

                    if (isNaN(salePrice) || salePrice < 0) {
                        return res.status(400).json({
                            message: "Sale price must be a non-negative number"
                        });
                    }

                    if (salePrice >= price) {
                        return res.status(400).json({
                            message: "Sale price must be less than regular price"
                        });
                    }
                }

                if (stock === undefined || isNaN(stock) || stock < 0) {
                    return res.status(400).json({
                        message: "Stock cannot be negative or missing"
                    });
                }

                // Prevent duplicate size + color combinations
                const duplicateVariant = processedVariants.find(
                    (item) =>
                        item.size.toLowerCase() === size.trim().toLowerCase() &&
                        item.color.toLowerCase() === color.trim().toLowerCase()
                );

                if (duplicateVariant) {
                    return res.status(400).json({
                        message: `Variant ${color} / ${size} already exists`
                    });
                }

                processedVariants.push({
                    sku: sku || `SKU-${Math.random()
                        .toString(36)
                        .substring(2, 8)
                        .toUpperCase()}`,
                    size: size.trim(),
                    color: color.trim(),
                    price,
                    salePrice: salePrice ?? null,
                    stock
                });
            }

            updateFields.variants = processedVariants;
        }

        const updateProduct = await Product.findByIdAndUpdate(
            id,
            updateFields,
            {
                new: true,
                runValidators: true
            }
        )
            .populate("category", "name description")
            .populate("brand", "name description");

        if (!updateProduct) {
            return res.status(404).json({
                message: "Product not found"
            });
        }

        return res.status(200).json({
            success: true,
            data: updateProduct
        });

    } catch (error) {
        console.log(
            "error in the edit product controller",
            error.message
        );

        return res.status(500).json({
            message: "internal server error"
        });
    }
};

export const getProductById = async (req, res) => {
    try {
        const { id } = req.params;

        const product = await Product.findById(id)
            .populate("category", "name description")
            .populate("brand", "name description");

        if (!product) {
            return res.status(404).json({
                message: "Product not found"
            });
        }

        return res.status(200).json({
            success: true,
            data: product
        });

    } catch (error) {
        console.log(
            "error in the get product by id controller",
            error.message
        );

        return res.status(500).json({
            message: "internal server error"
        });
    }
};

export const deleteProduct = async (req, res) => {
    try {
        const { id } = req.params
        const product = await Product.findByIdAndDelete(id)
        if (!product) {
            return res.status(404).json({ message: "product not found" })
        }
        res.status(200).json({ message: "product deleted successfully" })
    } catch (error) {
        console.log("error in the delete products controller", error.message);
        res.status(500).json({ message: "internal server error" });
    }
}