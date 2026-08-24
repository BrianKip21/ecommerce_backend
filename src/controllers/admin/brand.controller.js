import Brand from "../../models/brand.model.js";

export const addBrand = async (req, res) => {
    try {
        const { name, description } = req.body
        if (!name?.trim()) {
            return res.status(400).json({ message: "Brand name is required" })
        }

        const brandName = name.trim();

        const existingBrand = await Brand.findOne({ name: brandName })
        if (existingBrand) {
            return res.status(400).json({ message: "brand already exists" })
        }
        const newBrand = new Brand({
            name: brandName,
            description
        })

        await newBrand.save()

        return res.status(201).json({ success: true, data: newBrand })
    } catch (error) {
        console.log("error in the add brand controller", error.message);
        res.status(500).json({ message: "internal server error" });
    }
}

export const getAllBrands = async (req, res) => {
    try {
        const brandList = await Brand.find({})
        return res.status(200).json({ data: brandList })
    } catch (error) {
        console.log("error in the get all brands controller", error.message);
        res.status(500).json({ message: "internal server error" });
    }

}

export const getBrandById = async (req, res) => {
    try {
        const { id } = req.params;

        const brand = await Brand.findById(id);

        if (!brand) {
            return res.status(404).json({
                message: "Brand not found"
            });
        }

        res.status(200).json({
            data: brand
        });

    } catch (error) {
        console.log("error in the get brand controller", error.message);

        res.status(500).json({
            message: "Internal server error"
        });
    }
};

export const editBrand = async (req, res) => {
    try {
        const { id } = req.params
        const { name, description } = req.body

        if (Object.keys(req.body).length === 0) {
            return res.status(400).json({ message: "No fields provided for update" })
        }

        const updateFields = {};

        if (name !== undefined) {
            const brandName = name.trim();

            if (!brandName) {
                return res.status(400).json({ message: "Brand name cannot be empty" })
            }


            const existingBrand = await Brand.findOne({
                name: brandName,
                _id: { $ne: id }
            })

            if (existingBrand) {
                return res.status(400).json({
                    message: "Brand already exists"
                })
            }

            updateFields.name = brandName;
        }

        if (description !== undefined) updateFields.description = description

        const updateBrand = await Brand.findByIdAndUpdate(
            id,
            updateFields,
            { new: true, runValidators: true })
        if (!updateBrand) {
            return res.status(404).json({ message: "brand not found" })
        }
        res.status(200).json({ data: updateBrand })
    } catch (error) {
        console.log("error in the edit brand controller", error.message);
        res.status(500).json({ message: "internal server error" });
    }
}

export const deleteBrand = async (req, res) => {
    try {
        const { id } = req.params;

        // Validate brand ID
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                message: "Invalid brand id"
            });
        }

        // Check whether any products still use this brand
        const productsUsingBrand =
            await Product.countDocuments({
                brand: id
            });

        if (productsUsingBrand > 0) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                message:
                    `Cannot delete brand — ${productsUsingBrand} product(s) still use it`
            });
        }

        // Delete brand
        const brand = await Brand.findByIdAndDelete(id);

        if (!brand) {
            return res.status(StatusCodes.NOT_FOUND).json({
                message: "Brand not found"
            });
        }

        return res.status(StatusCodes.OK).json({
            success: true,
            message: "Brand deleted successfully"
        });

    } catch (error) {
        console.error(
            "Error in delete brand controller:",
            error.message
        );

        return res.status(
            StatusCodes.INTERNAL_SERVER_ERROR
        ).json({
            message: "Internal server error"
        });
    }
};