import Review from "../models/review.model.js"
import Product from "../models/product.model.js";

export const recalculateAverageReview = async (productId) => {
    const stats = await Review.aggregate([
        {
            $match: {
                product: productId
            }
        },
        {
            $group: {
                _id: "$product",
                averageReview: {
                    $avg: "$rating"
                },
                reviewCount: {
                    $sum: 1
                }
            }
        }
    ]);

    const averageReview =
        stats.length > 0
            ? Math.round(stats[0].averageReview * 10) / 10
            : 0;

    const reviewCount =
        stats.length > 0
            ? stats[0].reviewCount
            : 0;

    await Product.findByIdAndUpdate(productId, {
        averageReview,
        reviewCount
    });
};