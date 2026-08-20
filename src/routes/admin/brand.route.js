import express from "express"

import { addBrand, getAllBrands, editBrand, deleteBrand } from "../../controllers/admin/brand.controller.js"

const router = express.Router()

router.route('/').get(getAllBrands).post(addBrand)
router.route('/:id').patch(editBrand).delete(deleteBrand)

export default router;