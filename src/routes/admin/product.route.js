import express from "express"

import { addProduct, getAllProducts, getProductById, editProduct, deleteProduct } from "../../controllers/admin/product.controller.js"

const router = express.Router()

router.route('/').get(getAllProducts).post(addProduct)
router.route('/:id').patch(editProduct).delete(deleteProduct).get(getProductById)

export default router;