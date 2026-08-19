import Product from "../../models/product.model.js"

const addProduct = async (req, res) => {
    try {
        const { image,
            title,
            description,
            category,
            brand,
            price,
            salePrice,
            totalStock
        } = req.body
    
        if (!title || !description || !category || !brand || price === undefined)
            return res.status(400).json({ message: "required product fields are missing" })
        if (price < 0) {
            return res.status(400).json({ message: "price cannot be negative" })
        }
        if(totalStock < 0){
            return res.status(400).json({message: "stock cannot be negative"})
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