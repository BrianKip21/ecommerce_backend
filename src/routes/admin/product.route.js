import express from "express"

import { addProduct, getAllProducts, editProduct, deleteProduct } from "../../controllers/admin/product.controller.js"

const router = express.Router()

router.route('/').get(getAllProducts).post(addProduct)
router.route('/:id').patch(editProduct).delete(deleteProduct)

export default router;