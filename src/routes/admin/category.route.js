import express from "express";

import { authenticate } from "../../middleware/authMiiddleware.js";
import { isAdmin } from "../../middleware/roleMiddleware.js";
import upload from "../../middleware/uploadMiddleware.js";

import {
    addCategory,
    getAllCategories,
    getCategoryById,
    editCategory,
    deleteCategory
} from "../../controllers/admin/category.controller.js";

const router = express.Router();

router.route("/")
    .get(getAllCategories)
    .post(
        authenticate,
        isAdmin,
        upload.single("image"),
        addCategory
    );

router.route("/:id")
    .patch(
        authenticate,
        isAdmin,
        upload.single("image"),
        editCategory
    )
    .delete(
        authenticate,
        isAdmin,
        deleteCategory
    )
    .get(getCategoryById);

export default router;