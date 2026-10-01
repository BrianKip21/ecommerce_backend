import mongoose from "mongoose";
import { StatusCodes } from "http-status-codes";


// ============================================================
// ESCAPE REGEX
// ============================================================

const escapeRegex = (value) => {
    return value.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
    );
};


// ============================================================
// BUILD PRODUCT FILTER
// ============================================================

export const buildProductFilter = (query, res) => {
    const {
        search,
        category,
        brand,
        minPrice,
        maxPrice,
        size,
        color
    } = query;

    const filter = {};

    // --------------------------------------------------------
    // SEARCH
    // --------------------------------------------------------

    if (search?.trim()) {
        const searchTerm =
            escapeRegex(search.trim());

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
            !mongoose.Types.ObjectId.isValid(
                category
            )
        ) {
            res.status(
                StatusCodes.BAD_REQUEST
            ).json({
                message:
                    "Invalid category id"
            });

            return null;
        }

        filter.category = category;
    }

    // --------------------------------------------------------
    // BRAND
    // --------------------------------------------------------

    if (brand) {
        if (
            !mongoose.Types.ObjectId.isValid(
                brand
            )
        ) {
            res.status(
                StatusCodes.BAD_REQUEST
            ).json({
                message:
                    "Invalid brand id"
            });

            return null;
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
            res.status(
                StatusCodes.BAD_REQUEST
            ).json({
                message:
                    "minPrice must be a valid non-negative number"
            });

            return null;
        }
    }

    if (maxPrice !== undefined) {
        max = Number(maxPrice);

        if (
            !Number.isFinite(max) ||
            max < 0
        ) {
            res.status(
                StatusCodes.BAD_REQUEST
            ).json({
                message:
                    "maxPrice must be a valid non-negative number"
            });

            return null;
        }
    }

    if (
        min !== undefined &&
        max !== undefined &&
        min > max
    ) {
        res.status(
            StatusCodes.BAD_REQUEST
        ).json({
            message:
                "minPrice cannot be greater than maxPrice"
        });

        return null;
    }

    // --------------------------------------------------------
    // VARIANT FILTERS
    // --------------------------------------------------------

    const variantConditions = {};

    // PRICE
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

    // SIZE
    if (size?.trim()) {
        variantConditions.size =
            size.trim();
    }

    // COLOR
    if (color?.trim()) {
        const colorTerm =
            escapeRegex(color.trim());

        variantConditions.color = {
            $regex: `^${colorTerm}$`,
            $options: "i"
        };
    }

    // Apply variant conditions
    // to the same array element
    if (
        Object.keys(variantConditions).length > 0
    ) {
        filter.variants = {
            $elemMatch:
                variantConditions
        };
    }

    return filter;
};


// ============================================================
// BUILD SORT OPTION
// ============================================================

export const buildSortOption = (sort) => {
    switch (sort) {

        case "oldest":
            return {
                createdAt: 1
            };

        case "price_asc":
            return {
                "variants.0.price": 1
            };

        case "price_desc":
            return {
                "variants.0.price": -1
            };

        case "rating":
            return {
                averageReview: -1,
                createdAt: -1
            };

        case "most_reviewed":
            return {
                reviewCount: -1,
                createdAt: -1
            };

        case "newest":
        default:
            return {
                createdAt: -1
            };
    }
};


// ============================================================
// BUILD PAGINATION
// ============================================================

export const buildPagination = (
    page,
    limit
) => {
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

    return {
        pageNum,
        limitNum,
        skip
    };
};