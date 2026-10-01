import helmet from "helmet";
import cors from "cors";


// ============================================================
// ALLOWED ORIGINS
// ============================================================

const allowedOrigins = [
    "http://localhost:5173", // User frontend
    "http://localhost:5175", // Admin frontend

    // Production
    process.env.USER_FRONTEND_URL,
    process.env.ADMIN_FRONTEND_URL
].filter(Boolean);


// ============================================================
// HELMET
// ============================================================

export const securityHeaders = helmet({
    // Prevent MIME-type sniffing
    xContentTypeOptions: true,

    // Prevent clickjacking
    frameguard: {
        action: "deny"
    },

    // Control Referer information
    referrerPolicy: {
        policy: "strict-origin-when-cross-origin"
    },

    // Disable DNS prefetching
    xDnsPrefetchControl: {
        allow: false
    },

    // Restrict browser permissions
    permissionsPolicy: {
        features: {
            camera: [],
            microphone: [],
            geolocation: []
        }
    }
});


// ============================================================
// CORS
// ============================================================

export const corsOptions = {

    origin: (origin, callback) => {

        // Allow requests without Origin
        //
        // Examples:
        // - Postman
        // - server-to-server requests
        // - command-line tools
        if (!origin) {
            return callback(null, true);
        }

        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }

        console.warn(
            `Blocked CORS request from: ${origin}`
        );

        return callback(
            new Error("Origin is not allowed by CORS")
        );
    },


    // Required because your JWT is stored in cookies
    credentials: true,


    methods: [
        "GET",
        "POST",
        "PUT",
        "PATCH",
        "DELETE",
        "OPTIONS"
    ],


    allowedHeaders: [
        "Content-Type",
        "Authorization",
        "Accept",
        "Origin",
        "X-Requested-With"
    ],


    exposedHeaders: [
        "Content-Length"
    ],


    // Cache successful preflight requests
    // for 10 minutes.
    maxAge: 600,


    optionsSuccessStatus: 204
};


// ============================================================
// CORS MIDDLEWARE
// ============================================================

export const corsMiddleware =
    cors(corsOptions);
