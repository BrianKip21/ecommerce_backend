import { supabase } from "./supabase.js";
import sharp from "sharp";
import crypto from "crypto";

const BUCKET = "Products";

// ============================================================
// UPLOAD IMAGE
// ============================================================

export const uploadToStorage = async (
    buffer,
    originalName
) => {
    if (!Buffer.isBuffer(buffer)) {
        throw new Error("A valid image buffer is required");
    }

    if (buffer.length === 0) {
        throw new Error("Empty image buffer provided");
    }

    // --------------------------------------------------------
    // ORIGINAL UPLOAD LIMIT
    // --------------------------------------------------------

    const MAX_SIZE = 20 * 1024 * 1024;

    if (buffer.length > MAX_SIZE) {
        throw new Error(
            "Image is too large. Maximum size is 20MB"
        );
    }

    // --------------------------------------------------------
    // OPTIMIZE IMAGE
    // --------------------------------------------------------

    console.log(
        `Original image size: ${(buffer.length / 1024 / 1024).toFixed(2)} MB`
    );

    const optimizedBuffer = await sharp(buffer)
        .rotate()
        .resize({
            width: 1600,
            height: 2000,
            fit: "inside",
            withoutEnlargement: true
        })
        .webp({
            quality: 82,
            effort: 4
        })
        .toBuffer();

    console.log(
        `Optimized image size: ${(optimizedBuffer.length / 1024 / 1024).toFixed(2)} MB`
    );

    // --------------------------------------------------------
    // GENERATE FILE NAME
    // --------------------------------------------------------

    const fileName =
        `${crypto.randomUUID()}.webp`;

    const filePath =
        `products/${fileName}`;

    // --------------------------------------------------------
    // UPLOAD TO SUPABASE
    // --------------------------------------------------------

    const { error } =
        await supabase.storage
            .from(BUCKET)
            .upload(
                filePath,
                optimizedBuffer,
                {
                    contentType: "image/webp",
                    cacheControl: "31536000",
                    upsert: false
                }
            );

    if (error) {
        console.error(
            "Supabase upload error:",
            error
        );

        throw error;
    }

    // --------------------------------------------------------
    // PUBLIC URL
    // --------------------------------------------------------

    const { data } =
        supabase.storage
            .from(BUCKET)
            .getPublicUrl(filePath);

    if (!data?.publicUrl) {
        throw new Error(
            "Supabase did not return a public URL"
        );
    }

    console.log(
        "Supabase upload successful:",
        filePath
    );

    return {
        secure_url: data.publicUrl,
        public_id: filePath
    };
};


// ============================================================
// DELETE IMAGE
// ============================================================

export const deleteFromStorage = async (
    filePath
) => {
    if (!filePath) {
        return null;
    }

    try {
        const { data, error } =
            await supabase.storage
                .from(BUCKET)
                .remove([filePath]);

        if (error) {
            console.error(
                "Supabase delete error:",
                error
            );

            throw error;
        }

        return data;

    } catch (error) {
        console.error(
            "Supabase delete error:",
            error.message
        );

        throw error;
    }
};