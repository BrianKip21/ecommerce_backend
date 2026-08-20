import express from "express"

import { addCategory, getAllCategories, editCategory, deleteCategory } from "../../controllers/admin/category.controller.js"

const router = express.Router()

router.route('/').get(getAllCategories).post(addCategory)
router.route('/:id').patch(editCategory).delete(deleteCategory)

export default router; 