import Category from "../../models/category.model.js";

export const addCategory = async (req, res) => {
    try {
        const { name, description } = req.body
        if (!name?.trim()) {
            return res.status(400).json({ message: "Category name is required" })
        }

        const categoryName = name.trim();

        const existingCategory = await Category.findOne({ name: categoryName })
        if (existingCategory) {
            return res.status(400).json({ message: "category already exists" })
        }
        const newCategory = new Category({
            name: categoryName,
            description
        })

        await newCategory.save()

        return res.status(201).json({ success: true, data: newCategory })
    } catch (error) {
        console.log("error in the add category controller", error.message);
        res.status(500).json({ message: "internal server error" });
    }
}

export const getAllCategories = async (req, res) => {
    try {
        const categoryList = await Category.find({})
        return res.status(200).json({ data: categoryList })
    } catch (error) {
        console.log("error in the get all category controller", error.message);
        res.status(500).json({ message: "internal server error" });
    }

}

export const getCategoryById = async (req, res) => {
    try {
        const { id } = req.params;

        const category = await Category.findById(id);

        if (!category) {
            return res.status(404).json({
                message: "Category not found"
            });
        }

        res.status(200).json({
            data: category
        });

    } catch (error) {
        console.log("error in the get category controller", error.message);

        res.status(500).json({
            message: "Internal server error"
        });
    }
};

export const editCategory = async (req, res) => {
    try {
        const { id } = req.params
        const { name, description } = req.body

        if (Object.keys(req.body).length === 0) {
            return res.status(400).json({
                message: "No fields provided for update"
            })
        }

        const updateFields = {};

        if (name !== undefined) {
            const categoryName = name.trim();

            if (!categoryName) {
                return res.status(400).json({
                    message: "Category name cannot be empty"
                })
            }

            const existingCategory = await Category.findOne({
                name: categoryName,
                _id: { $ne: id}
            })

            if (existingCategory) {
                return res.status(400).json({
                    message: "Category already exists"
                });
            }
            updateFields.name = categoryName;
        }
        if (description !== undefined) updateFields.description = description

        const updateCategory = await Category.findByIdAndUpdate(
            id,
            updateFields,
            { new: true, runValidators: true })
        if (!updateCategory) {
            return res.status(404).json({ message: "category not found" })
        }
        res.status(200).json({ data: updateCategory })
    } catch (error) {
        console.log("error in the edit category controller", error.message);
        res.status(500).json({ message: "internal server error" });
    }
}

export const deleteCategory = async (req, res) => {
    try {
        const { id } = req.params
        const category = await Category.findByIdAndDelete(id)
        if (!category) {
            return res.status(404).json({ message: "category not found" })
        }
        res.status(200).json({ message: "category deleted successfully" })
    } catch (error) {
        console.log("error in the delete category controller", error.message);
        res.status(500).json({ message: "internal server error" });
    }
}