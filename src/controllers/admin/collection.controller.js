import { StatusCodes } from "http-status-codes";
import mongoose from "mongoose";

import Collection from "../../models/collection.model.js";
import Product from "../../models/product.model.js";

import { generateUniqueSlug } from "../../lib/slug.js";

import {
    uploadToStorage,
    deleteFromStorage
} from "../../lib/storage.js";

import {
    buildProductFilter,
    buildSortOption,
    buildPagination
} from "../../lib/productFilters.js";


// --------------------------------------------------
// Helpers
// --------------------------------------------------

const parseProductIds = (products) => {
    if (products === undefined || products === null) {
        return [];
    }

    let productIds = products;

    // FormData sends arrays as strings
    if (typeof products === "string") {
        try {
            productIds = JSON.parse(products);
        } catch {
            throw new Error(
                "products must be a valid JSON array"
            );
        }
    }

    if (!Array.isArray(productIds)) {
        throw new Error(
            "products must be an array"
        );
    }

    // Remove duplicates
    productIds = [...new Set(productIds)];

    // Validate ObjectIds
    for (const productId of productIds) {
        if (!mongoose.Types.ObjectId.isValid(productId)) {
            throw new Error(
                `Invalid product ID: ${productId}`
            );
        }
    }

    return productIds;
};


const validateProductsExist = async (productIds) => {
    if (productIds.length === 0) {
        return;
    }

    const count = await Product.countDocuments({
        _id: { $in: productIds }
    });

    if (count !== productIds.length) {
        throw new Error(
            "One or more selected products do not exist"
        );
    }
};


const parseBoolean = (
    value,
    defaultValue = true
) => {
    if (value === undefined) {
        return defaultValue;
    }

    if (typeof value === "boolean") {
        return value;
    }

    if (typeof value === "string") {
        if (value === "true") return true;
        if (value === "false") return false;
    }

    throw new Error(
        "isActive must be true or false"
    );
};


const parseSortOrder = (
    value,
    defaultValue = 0
) => {
    if (value === undefined) {
        return defaultValue;
    }

    const number = Number(value);

    if (!Number.isFinite(number)) {
        throw new Error(
            "sortOrder must be a valid number"
        );
    }

    return number;
};


// --------------------------------------------------
// CREATE COLLECTION
// --------------------------------------------------

export const createCollection = async (
    req,
    res
) => {
    let uploadedImage = null;

    try {
        const {
            name,
            description,
            products,
            isActive,
            sortOrder
        } = req.body;

        // -----------------------------
        // Validate name
        // -----------------------------

        if (!name?.trim()) {
            return res.status(
                StatusCodes.BAD_REQUEST
            ).json({
                message: "Collection name is required"
            });
        }

        const cleanName = name.trim();


        // -----------------------------
        // Check duplicate name
        // -----------------------------

        const existingCollection =
            await Collection.findOne({
                name: cleanName
            });

        if (existingCollection) {
            return res.status(
                StatusCodes.CONFLICT
            ).json({
                message:
                    "A collection with this name already exists"
            });
        }


        // -----------------------------
        // Products
        // -----------------------------

        const productIds =
            parseProductIds(products);

        await validateProductsExist(
            productIds
        );


        // -----------------------------
        // Other fields
        // -----------------------------

        const active =
            parseBoolean(isActive, true);

        const order =
            parseSortOrder(sortOrder, 0);


        // -----------------------------
        // Generate slug
        // -----------------------------

        const slug =
            await generateUniqueSlug(
                cleanName
            );


        // -----------------------------
        // Upload image
        // -----------------------------

        let image = undefined;
        let imagePublicId = undefined;

        if (req.file) {
            uploadedImage =
                await uploadToStorage(
                    req.file.buffer,
                    req.file.originalname,
                    "collections"
                );

            image =
                uploadedImage.secure_url;

            imagePublicId =
                uploadedImage.public_id;
        }


        // -----------------------------
        // Create collection
        // -----------------------------

        const collection =
            await Collection.create({
                name: cleanName,
                slug,
                description:
                    description?.trim(),
                image,
                imagePublicId,
                products: productIds,
                isActive: active,
                sortOrder: order
            });


        // -----------------------------
        // Response
        // -----------------------------

        res.status(
            StatusCodes.CREATED
        ).json({
            message:
                "Collection created successfully",
            collection
        });

    } catch (error) {

        // Clean up uploaded image
        // if database creation failed
        if (uploadedImage?.public_id) {
            try {
                await deleteFromStorage(
                    uploadedImage.public_id
                );
            } catch (cleanupError) {
                console.error(
                    "Failed to clean up collection image:",
                    cleanupError.message
                );
            }
        }


        // Mongo duplicate key
        if (error.code === 11000) {
            return res.status(
                StatusCodes.CONFLICT
            ).json({
                message:
                    "A collection with this name or slug already exists"
            });
        }


        console.error(
            "Create collection error:",
            error
        );

        res.status(
            StatusCodes.INTERNAL_SERVER_ERROR
        ).json({
            message:
                "Failed to create collection"
        });
    }
};


// --------------------------------------------------
// UPDATE COLLECTION
// --------------------------------------------------

export const updateCollection = async (
    req,
    res
) => {
    let newUploadedImage = null;

    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(
                StatusCodes.BAD_REQUEST
            ).json({
                message: "Invalid collection ID"
            });
        }


        const collection =
            await Collection.findById(id);

        if (!collection) {
            return res.status(
                StatusCodes.NOT_FOUND
            ).json({
                message: "Collection not found"
            });
        }


        const {
            name,
            description,
            products,
            isActive,
            sortOrder
        } = req.body;


        // -----------------------------
        // Name
        // -----------------------------

        if (
            name !== undefined &&
            !name.trim()
        ) {
            return res.status(
                StatusCodes.BAD_REQUEST
            ).json({
                message:
                    "Collection name cannot be empty"
            });
        }


        if (
            name !== undefined &&
            name.trim() !== collection.name
        ) {
            const existing =
                await Collection.findOne({
                    name: name.trim(),
                    _id: { $ne: id }
                });

            if (existing) {
                return res.status(
                    StatusCodes.CONFLICT
                ).json({
                    message:
                        "A collection with this name already exists"
                });
            }

            collection.name =
                name.trim();

            /*
             * We intentionally do NOT change
             * the slug here.
             *
             * This prevents existing URLs from
             * breaking when an admin renames
             * the collection.
             */
        }


        // -----------------------------
        // Description
        // -----------------------------

        if (
            description !== undefined
        ) {
            collection.description =
                description.trim();
        }


        // -----------------------------
        // Products
        // -----------------------------

        if (
            products !== undefined
        ) {
            const productIds =
                parseProductIds(products);

            await validateProductsExist(
                productIds
            );

            collection.products =
                productIds;
        }


        // -----------------------------
        // Active status
        // -----------------------------

        if (
            isActive !== undefined
        ) {
            collection.isActive =
                parseBoolean(
                    isActive,
                    collection.isActive
                );
        }


        // -----------------------------
        // Sort order
        // -----------------------------

        if (
            sortOrder !== undefined
        ) {
            collection.sortOrder =
                parseSortOrder(
                    sortOrder,
                    collection.sortOrder
                );
        }


        // -----------------------------
        // Image
        // -----------------------------

        const oldImagePublicId =
            collection.imagePublicId;

        if (req.file) {
            newUploadedImage =
                await uploadToStorage(
                    req.file.buffer,
                    req.file.originalname,
                    "collections"
                );

            collection.image =
                newUploadedImage.secure_url;

            collection.imagePublicId =
                newUploadedImage.public_id;
        }


        // -----------------------------
        // Save
        // -----------------------------

        await collection.save();


        // -----------------------------
        // Delete old image
        // -----------------------------

        if (
            req.file &&
            oldImagePublicId
        ) {
            try {
                await deleteFromStorage(
                    oldImagePublicId
                );
            } catch (error) {
                console.error(
                    "Failed to delete old collection image:",
                    error.message
                );
            }
        }


        await collection.populate({
            path: "products",
            select:
                "title image variants averageReview reviewCount"
        });


        res.status(
            StatusCodes.OK
        ).json({
            message:
                "Collection updated successfully",
            collection
        });

    } catch (error) {

        // Clean up new image if update failed
        if (newUploadedImage?.public_id) {
            try {
                await deleteFromStorage(
                    newUploadedImage.public_id
                );
            } catch (cleanupError) {
                console.error(
                    "Failed to clean up new collection image:",
                    cleanupError.message
                );
            }
        }


        if (error.code === 11000) {
            return res.status(
                StatusCodes.CONFLICT
            ).json({
                message:
                    "A collection with this name or slug already exists"
            });
        }


        console.error(
            "Update collection error:",
            error
        );

        res.status(
            StatusCodes.INTERNAL_SERVER_ERROR
        ).json({
            message:
                "Failed to update collection"
        });
    }
};


// --------------------------------------------------
// DELETE COLLECTION
// --------------------------------------------------

export const deleteCollection = async (
    req,
    res
) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(
                StatusCodes.BAD_REQUEST
            ).json({
                message: "Invalid collection ID"
            });
        }


        const collection =
            await Collection.findById(id);

        if (!collection) {
            return res.status(
                StatusCodes.NOT_FOUND
            ).json({
                message: "Collection not found"
            });
        }


        const imagePublicId =
            collection.imagePublicId;


        await Collection.findByIdAndDelete(id);


        // Storage deletion should not
        // make a successful DB deletion
        // appear to have failed.
        if (imagePublicId) {
            try {
                await deleteFromStorage(
                    imagePublicId
                );
            } catch (error) {
                console.error(
                    "Failed to delete collection image:",
                    error.message
                );
            }
        }


        res.status(
            StatusCodes.OK
        ).json({
            message:
                "Collection deleted successfully"
        });

    } catch (error) {

        console.error(
            "Delete collection error:",
            error
        );

        res.status(
            StatusCodes.INTERNAL_SERVER_ERROR
        ).json({
            message:
                "Failed to delete collection"
        });
    }
};


// --------------------------------------------------
// ADMIN — GET ALL COLLECTIONS
// --------------------------------------------------

export const getAllCollectionsAdmin = async (
    req,
    res
) => {
    try {
        const collections =
            await Collection.find()
                .sort({
                    sortOrder: 1,
                    createdAt: -1
                })
                .select(
                    "name slug description image products isActive sortOrder createdAt updatedAt"
                )
                .lean();


        const formattedCollections =
            collections.map(
                (collection) => ({
                    ...collection,
                    productCount:
                        collection.products?.length || 0
                })
            );


        res.status(
            StatusCodes.OK
        ).json({
            collections:
                formattedCollections
        });

    } catch (error) {

        console.error(
            "Get admin collections error:",
            error
        );

        res.status(
            StatusCodes.INTERNAL_SERVER_ERROR
        ).json({
            message:
                "Failed to fetch collections"
        });
    }
};


// --------------------------------------------------
// PUBLIC — GET ACTIVE COLLECTIONS
// --------------------------------------------------

export const getCollections = async (
    req,
    res
) => {
    try {
        const collections =
            await Collection.find({
                isActive: true
            })
                .sort({
                    sortOrder: 1,
                    createdAt: -1
                })
                .select(
                    "name slug description image products sortOrder"
                )
                .lean();


        const formattedCollections =
            collections.map(
                (collection) => ({
                    _id: collection._id,
                    name: collection.name,
                    slug: collection.slug,
                    description:
                        collection.description,
                    image: collection.image,
                    sortOrder:
                        collection.sortOrder,
                    productCount:
                        collection.products?.length || 0
                })
            );


        res.status(
            StatusCodes.OK
        ).json({
            collections:
                formattedCollections
        });

    } catch (error) {

        console.error(
            "Get collections error:",
            error
        );

        res.status(
            StatusCodes.INTERNAL_SERVER_ERROR
        ).json({
            message:
                "Failed to fetch collections"
        });
    }
};


// --------------------------------------------------
// PUBLIC — GET PRODUCTS IN COLLECTION
// --------------------------------------------------

export const getCollectionBySlug = async (
    req,
    res
) => {
    try {
        const { slug } = req.params;

        if (!slug?.trim()) {
            return res.status(
                StatusCodes.BAD_REQUEST
            ).json({
                message:
                    "Collection slug is required"
            });
        }


        const collection =
            await Collection.findOne({
                slug: slug.toLowerCase(),
                isActive: true
            })
                .select(
                    "name slug description image products"
                )
                .lean();


        if (!collection) {
            return res.status(
                StatusCodes.NOT_FOUND
            ).json({
                message:
                    "Collection not found"
            });
        }


        // --------------------------------
        // Reuse normal product filters
        // --------------------------------

        const filter =
            buildProductFilter(
                req.query,
                res
            );

        if (!filter) {
            return;
        }


        // --------------------------------
        // Restrict products to collection
        // --------------------------------

        filter._id = {
            $in: collection.products || []
        };


        // --------------------------------
        // Sorting
        // --------------------------------

        const sort =
            buildSortOption(
                req.query.sort
            );


        // --------------------------------
        // Pagination
        // --------------------------------

        const {
            pageNum,
            limitNum,
            skip
        } = buildPagination(
            req.query.page,
            req.query.limit
        );


        // --------------------------------
        // Query products + count
        // --------------------------------

        const [
            products,
            total
        ] = await Promise.all([
            Product.find(filter)
                .populate(
                    "category",
                    "name"
                )
                .populate(
                    "brand",
                    "name"
                )
                .sort(sort)
                .skip(skip)
                .limit(limitNum),

            Product.countDocuments(filter)
        ]);


        res.status(
            StatusCodes.OK
        ).json({
            collection: {
                _id: collection._id,
                name: collection.name,
                slug: collection.slug,
                description:
                    collection.description,
                image: collection.image
            },

            products,

            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages:
                    Math.ceil(
                        total / limitNum
                    )
            }
        });

    } catch (error) {

        console.error(
            "Get collection by slug error:",
            error
        );

        res.status(
            StatusCodes.INTERNAL_SERVER_ERROR
        ).json({
            message:
                "Failed to fetch collection"
        });
    }
};