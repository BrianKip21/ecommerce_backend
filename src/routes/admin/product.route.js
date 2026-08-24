import express from "express"

import { authenticate } from "../../middleware/authMiiddleware.js"
import { isAdmin } from "../../middleware/roleMiddleware.js"
import { addProduct, getAllProducts, getProductById, editProduct, deleteProduct } from "../../controllers/admin/product.controller.js"
import upload from "../../middleware/uploadMiddleware.js"

const router = express.Router()

router.route('/')
    .get(getAllProducts)
    .post(authenticate, isAdmin, upload.single("image"),addProduct)
router.route('/:id')
    .patch(authenticate, isAdmin, upload.single("image"), editProduct)
    .delete(authenticate, isAdmin, upload.single("image"), deleteProduct)
    .get(getProductById)

export default router;