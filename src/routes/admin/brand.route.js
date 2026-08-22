import express from "express"

import { authenticate } from "../../middleware/authMiiddleware.js"
import { isAdmin } from "../../middleware/roleMiddleware.js"
import { addBrand, getAllBrands, getBrandById, editBrand, deleteBrand } from "../../controllers/admin/brand.controller.js"

const router = express.Router()

router.route('/')
    .get(getAllBrands)
    .post(authenticate, isAdmin, addBrand)
router.route('/:id')
    .patch(authenticate, isAdmin, editBrand)
    .delete(authenticate, isAdmin, deleteBrand)
    .get(getBrandById)

export default router;