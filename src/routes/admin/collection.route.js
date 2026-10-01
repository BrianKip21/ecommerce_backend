import express from "express";

import {
    authenticate
} from "../../middleware/authMiiddleware.js";

import { isAdmin } from "../../middleware/roleMiddleware.js"

import upload from "../../middleware/uploadMiddleware.js"

import {
    createCollection,
    updateCollection,
    deleteCollection,
    getAllCollectionsAdmin,
    getCollections,
    getCollectionBySlug
} from "../../controllers/admin/collection.controller.js";

const router = express.Router();


// ============================================================
// ADMIN
// ============================================================

router.get(
    "/admin/all",
    authenticate,
    isAdmin,
    getAllCollectionsAdmin
);

router.post(
    "/",
    authenticate,
    isAdmin,
    upload.single("image"),
    createCollection
);

router.patch(
    "/:id",
    authenticate,
    isAdmin,
    upload.single("image"),
    updateCollection
);

router.delete(
    "/:id",
    authenticate,
    isAdmin,
    deleteCollection
);


// ============================================================
// PUBLIC
// ============================================================

router.get(
    "/",
    getCollections
);

router.get(
    "/:slug",
    getCollectionBySlug
);

export default router;