import express from "express"

import { authenticate } from "../../middleware/authMiiddleware.js"
import { isAdmin } from "../../middleware/roleMiddleware.js"
import { addProduct, getAllProducts, getProductById, editProduct, deleteProduct } from "../../controllers/admin/product.controller.js"

const router = express.Router()

router.route('/')
    .get(getAllProducts)
    .post(authenticate, isAdmin, addProduct)
router.route('/:id')
    .patch(authenticate, isAdmin, editProduct)
    .delete(authenticate, isAdmin, deleteProduct)
    .get(getProductById)

export default router;