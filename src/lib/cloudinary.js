import { v2 as cloudinary } from "cloudinary";

const {
    CLOUDINARY_CLOUD_NAME,
    CLOUDINARY_API_KEY,
    CLOUDINARY_API_SECRET
} = process.env;

if (
    !CLOUDINARY_CLOUD_NAME ||
    !CLOUDINARY_API_KEY ||
    !CLOUDINARY_API_SECRET
) {
    throw new Error(
        "Cloudinary configuration is missing"
    );
}

cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
    secure: true,
    timeout: 120000
});


// ============================================
// UPLOAD IMAGE
// ============================================

export const uploadToCloudinary = async (
    buffer,
    folder = "ecommerce",
    maxRetries = 3
) => {

    if (!Buffer.isBuffer(buffer)) {
        throw new Error("A valid image buffer is required");
    }

    if (buffer.length === 0) {
        throw new Error("Empty image buffer provided");
    }

    const MAX_SIZE = 10 * 1024 * 1024;

    if (buffer.length > MAX_SIZE) {
        throw new Error(
            `Image is too large. Maximum size is 10MB`
        );
    }

    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {

        try {

            console.log(
                `Cloudinary upload attempt ${attempt}/${maxRetries}`
            );

            const result = await new Promise(
                (resolve, reject) => {

                    const uploadStream =
                        cloudinary.uploader.upload_stream(
                            {
                                folder,
                                resource_type: "image",
                                timeout: 120000
                            },
                            (error, result) => {

                                if (error) {
                                    return reject(error);
                                }

                                if (!result?.secure_url) {
                                    return reject(
                                        new Error(
                                            "Cloudinary did not return an image URL"
                                        )
                                    );
                                }

                                resolve(result);
                            }
                        );

                    uploadStream.on(
                        "error",
                        reject
                    );

                    uploadStream.end(buffer);
                }
            );

            console.log(
                "Cloudinary upload successful:",
                result.public_id
            );

            return result;

        } catch (error) {

            lastError = error;

            console.error(
                `Cloudinary upload attempt ${attempt} failed:`,
                error.message
            );

            if (attempt < maxRetries) {

                const waitTime =
                    Math.pow(2, attempt) * 1000;

                await new Promise(resolve =>
                    setTimeout(resolve, waitTime)
                );
            }
        }
    }

    throw lastError ||
        new Error("Cloudinary upload failed");
};


// ============================================
// DELETE IMAGE
// ============================================

export const deleteFromCloudinary = async (
    publicId
) => {

    if (!publicId) {
        return null;
    }

    try {

        return await cloudinary.uploader.destroy(
            publicId,
            {
                resource_type: "image"
            }
        );

    } catch (error) {

        console.error(
            "Cloudinary delete error:",
            error.message
        );

        throw error;
    }
};

export default cloudinary;