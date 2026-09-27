// ============================================================
// GLOBAL ERROR HANDLER
// ============================================================

export const errorHandler = (err, req, res, next) => {

    console.error(
        `ERROR ${req.method} ${req.originalUrl}:`,
        err
    );


    // ========================================================
    // DEFAULT VALUES
    // ========================================================

    let statusCode =
        err.statusCode ||
        err.status ||
        500;

    let message =
        err.message ||
        "Internal server error";


    // ========================================================
    // CORS ERROR
    // ========================================================

    if (
        message === "Origin is not allowed by CORS"
    ) {
        statusCode = 403;

        message =
            "Request origin is not allowed";
    }


    // ========================================================
    // MULTER FILE SIZE ERROR
    // ========================================================

    if (
        err.code === "LIMIT_FILE_SIZE"
    ) {
        statusCode = 400;

        message =
            "Image is too large. Maximum file size is 20MB";
    }


    // ========================================================
    // MULTER FILE COUNT / FIELD ERRORS
    // ========================================================

    if (
        err.name === "MulterError"
    ) {
        statusCode = 400;

        if (err.code === "LIMIT_UNEXPECTED_FILE") {
            message =
                "Unexpected file upload field";
        } else {
            message =
                err.message ||
                "File upload error";
        }
    }


    // ========================================================
    // INVALID JSON
    // ========================================================

    if (
        err instanceof SyntaxError &&
        err.status === 400 &&
        "body" in err
    ) {
        statusCode = 400;

        message =
            "Invalid JSON in request body";
    }


    // ========================================================
    // MONGOOSE VALIDATION ERROR
    // ========================================================

    if (
        err.name === "ValidationError"
    ) {
        statusCode = 400;

        const errors = {};

        for (
            const [field, error]
            of Object.entries(err.errors)
        ) {
            errors[field] =
                error.message;
        }

        return res.status(statusCode).json({
            success: false,
            message: "Validation failed",
            errors
        });
    }


    // ========================================================
    // MONGOOSE INVALID OBJECT ID
    // ========================================================

    if (
        err.name === "CastError"
    ) {
        statusCode = 400;

        message =
            `Invalid ${err.path || "field"} value`;
    }


    // ========================================================
    // MONGODB DUPLICATE KEY
    // ========================================================

    if (
        err.code === 11000
    ) {
        statusCode = 409;

        const fields =
            Object.keys(
                err.keyPattern || {}
            );

        const field =
            fields[0] || "field";

        message =
            `A record with this ${field} already exists`;
    }


    // ========================================================
    // JWT ERRORS
    // ========================================================

    if (
        err.name === "JsonWebTokenError"
    ) {
        statusCode = 401;

        message =
            "Invalid authentication token";
    }


    if (
        err.name === "TokenExpiredError"
    ) {
        statusCode = 401;

        message =
            "Authentication token has expired";
    }


    // ========================================================
    // DEVELOPMENT DETAILS
    // ========================================================

    const response = {
        success: false,
        message
    };


    // Only expose detailed error information
    // during development.
    if (
        process.env.NODE_ENV !== "production"
    ) {
        response.error = {
            name: err.name,
            code: err.code,
            stack: err.stack
        };
    }


    // ========================================================
    // RESPONSE
    // ========================================================

    return res
        .status(statusCode)
        .json(response);
};
