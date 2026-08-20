import Product from "../../models/product.model.js"
import Category from "../../models/category.model.js"
import Brand from "../../models/brand.model.js"

export const addProduct = async (req, res) => {
    try {
        const { 
            image,
            title,
            description,
            category,
            brand,
            price,
            salePrice,
            totalStock
        } = req.body

        if (!image || !image.trim()) {
            return res.status(400).json({ message: "Product image must be provided" })
        }
        if (!title?.trim() || !description?.trim() || !category || !brand || price === undefined)
            return res.status(400).json({ message: "required product fields are missing" })
        if (isNaN(price) || price <= 0) {
            return res.status(400).json({ message: "price must be a positive number" })
        }
        if (salePrice !== undefined && salePrice !== null) {
            if (isNaN(salePrice) || salePrice < 0) {
                return res.status(400).json({ message: "Sale price must be positive number" })
            }
            if (salePrice >= price) {
                return res.status(400).json({ message: "Sale price must be less than regular price" })
            }
        }
        if (totalStock === undefined || totalStock < 0) {
            return res.status(400).json({ message: "stock cannot be negative or missing" })
        }

        const existingCategory = await Category.findById(category)

        if(!existingCategory){
            return res.status(400).json({ message: "Category not found" })
        }

        const existingBrand = await Brand.findById(brand);
        if(!existingBrand){
            return res.status(400).json({ message: "Brand not found" })
        }

        const newlyCreatedProduct = new Product({
            image,
            title,
            description,
            category,
            brand,
            price,
            salePrice,
            totalStock
        })

        await newlyCreatedProduct.save();

        res.status(201).json({
            success: true,
            data: newlyCreatedProduct
        });
    } catch (error) {
        console.log("error in the product add controller", error.message);
        res.status(500).json({ message: "internal server error" });
    }


}

export const getAllProducts = async (req, res) => {
    try {
        const productsList = await Product.find({})
        res.status(200).json({ data: productsList })
    } catch (error) {
        console.log("error in the fetch all products controller", error.message);
        res.status(500).json({ message: "internal server error" });
    }
}

export const editProduct = async (req, res) => {
    try {
        const { id } = req.params
        const { image,
            title,
            description,
            category,
            brand,
            price,
            salePrice,
            totalStock
        } = req.body

        if (Object.keys(req.body).length === 0) {
            return res.status(400).json({ message: "No fields provided for update" })
        }

        const updateFields = {};

        if (image !== undefined) {
            if (!image.trim()) {
                return res.status(400).json({
                    message: "Product image cannot be empty"
                });
            }

            updateFields.image = image.trim();
        }

        if (title !== undefined) {
            if (!title.trim()) {
                return res.status(400).json({
                    message: "Product title cannot be empty"
                });
            }

            updateFields.title = title.trim();
        }

        if (description !== undefined) {
            if (!description.trim()) {
                return res.status(400).json({
                    message: "Product description cannot be empty"
                });
            }

            updateFields.description = description.trim();
        }

        if (category !== undefined) {
            updateFields.category = category;
        }

        if (brand !== undefined) {
            updateFields.brand = brand;
        }

        if (price !== undefined) {
            if (isNaN(price) || price <= 0) {
                return res.status(400).json({
                    message: "Price must be a positive number"
                });
            }

            updateFields.price = price;
        }

        if (salePrice !== undefined && salePrice !== null) {
            if (isNaN(salePrice) || salePrice < 0) {
                return res.status(400).json({
                    message: "Sale price must be a non-negative number"
                });
            }

            updateFields.salePrice = salePrice;
        }

        if (totalStock !== undefined) {
            if (isNaN(totalStock) || totalStock < 0) {
                return res.status(400).json({
                    message: "Stock cannot be negative"
                });
            }

            updateFields.totalStock = totalStock;
        }
        const updateProduct = await Product.findByIdAndUpdate(id,
            updateFields, { new: true, runValidators: true })
        if (!updateProduct) {
            return res.status(400).json({ message: "product not found" })
        }
        res.status(200).json({ data: updateProduct })
    } catch (error) {
        console.log("error in the edit products controller", error.message);
        res.status(500).json({ message: "internal server error" });
    }
}

export const deleteProduct = async(req,res)=>{
    try {
        const{id} = req.params
        const product = await Product.findByIdAndDelete(id)
        if(!product){
            return res.status(404).json({message:"product not found"})
        }
        res.status(200).json({message:"product deleted successfully"})
    } catch (error) {
        console.log("error in the delete products controller", error.message);
        res.status(500).json({ message: "internal server error" });
    }
}