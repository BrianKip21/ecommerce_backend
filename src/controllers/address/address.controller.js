import { StatusCodes } from "http-status-codes";
import User from "../../models/user.model.js";

/**
 * Get all addresses belonging to the authenticated user
 */
export const getAddresses = async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select("addresses");

        if (!user) {
            return res.status(StatusCodes.NOT_FOUND).json({
                success: false,
                message: "User not found"
            });
        }

        return res.status(StatusCodes.OK).json({
            success: true,
            data: user.addresses
        });

    } catch (error) {
        console.error("Error in get addresses controller:", error.message);

        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: "Internal server error"
        });
    }
};


/**
 * Add a new address
 */
export const addAddress = async (req, res) => {
    try {
        const {
            label,
            fullName,
            phone,
            address,
            city,
            country,
            isDefault
        } = req.body;

        // Validate required fields
        if (
            !fullName?.trim() ||
            !phone?.trim() ||
            !address?.trim() ||
            !city?.trim() ||
            !country?.trim()
        ) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                success: false,
                message: "Full name, phone, address, city and country are required"
            });
        }

        const user = await User.findById(req.user._id);

        if (!user) {
            return res.status(StatusCodes.NOT_FOUND).json({
                success: false,
                message: "User not found"
            });
        }

        /*
         * The first address automatically becomes the default.
         *
         * If the customer explicitly chooses this address
         * as default, the existing default address is unset.
         */
        const shouldBeDefault =
            isDefault === true || user.addresses.length === 0;

        if (shouldBeDefault) {
            user.addresses.forEach((addr) => {
                addr.isDefault = false;
            });
        }

        user.addresses.push({
            label: label?.trim() || "Home",
            fullName: fullName.trim(),
            phone: phone.trim(),
            address: address.trim(),
            city: city.trim(),
            country: country.trim(),
            isDefault: shouldBeDefault
        });

        await user.save();

        return res.status(StatusCodes.CREATED).json({
            success: true,
            message: "Address added successfully",
            data: user.addresses
        });

    } catch (error) {
        console.error("Error in add address controller:", error.message);

        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: "Internal server error"
        });
    }
};


/**
 * Update an existing address
 */
export const updateAddress = async (req, res) => {
    try {
        const { addressId } = req.params;

        const {
            label,
            fullName,
            phone,
            address,
            city,
            country,
            isDefault
        } = req.body;

        const user = await User.findById(req.user._id);

        if (!user) {
            return res.status(StatusCodes.NOT_FOUND).json({
                success: false,
                message: "User not found"
            });
        }

        const target = user.addresses.id(addressId);

        if (!target) {
            return res.status(StatusCodes.NOT_FOUND).json({
                success: false,
                message: "Address not found"
            });
        }

        // Update only fields that were provided
        if (label !== undefined) {
            target.label = label.trim();
        }

        if (fullName !== undefined) {
            if (!fullName.trim()) {
                return res.status(StatusCodes.BAD_REQUEST).json({
                    success: false,
                    message: "Full name cannot be empty"
                });
            }

            target.fullName = fullName.trim();
        }

        if (phone !== undefined) {
            if (!phone.trim()) {
                return res.status(StatusCodes.BAD_REQUEST).json({
                    success: false,
                    message: "Phone cannot be empty"
                });
            }

            target.phone = phone.trim();
        }

        if (address !== undefined) {
            if (!address.trim()) {
                return res.status(StatusCodes.BAD_REQUEST).json({
                    success: false,
                    message: "Address cannot be empty"
                });
            }

            target.address = address.trim();
        }

        if (city !== undefined) {
            if (!city.trim()) {
                return res.status(StatusCodes.BAD_REQUEST).json({
                    success: false,
                    message: "City cannot be empty"
                });
            }

            target.city = city.trim();
        }

        if (country !== undefined) {
            if (!country.trim()) {
                return res.status(StatusCodes.BAD_REQUEST).json({
                    success: false,
                    message: "Country cannot be empty"
                });
            }

            target.country = country.trim();
        }

        /*
         * If this address is being made the default,
         * remove the default status from every other address.
         */
        if (isDefault === true) {
            user.addresses.forEach((addr) => {
                addr.isDefault = false;
            });

            target.isDefault = true;
        }

        /*
         * We intentionally do not allow:
         *
         * isDefault: false
         *
         * to remove the current default without
         * another address being selected as default.
         *
         * This guarantees that a user with addresses
         * always has one default address.
         */

        await user.save();

        return res.status(StatusCodes.OK).json({
            success: true,
            message: "Address updated successfully",
            data: user.addresses
        });

    } catch (error) {
        console.error("Error in update address controller:", error.message);

        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: "Internal server error"
        });
    }
};


/**
 * Delete an existing address
 */
export const deleteAddress = async (req, res) => {
    try {
        const { addressId } = req.params;

        const user = await User.findById(req.user._id);

        if (!user) {
            return res.status(StatusCodes.NOT_FOUND).json({
                success: false,
                message: "User not found"
            });
        }

        const target = user.addresses.id(addressId);

        if (!target) {
            return res.status(StatusCodes.NOT_FOUND).json({
                success: false,
                message: "Address not found"
            });
        }

        const wasDefault = target.isDefault;

        // Remove the address
        target.deleteOne();

        /*
         * If the deleted address was the default,
         * make another remaining address the default.
         */
        if (wasDefault && user.addresses.length > 0) {
            user.addresses[0].isDefault = true;
        }

        await user.save();

        return res.status(StatusCodes.OK).json({
            success: true,
            message: "Address deleted successfully",
            data: user.addresses
        });

    } catch (error) {
        console.error("Error in delete address controller:", error.message);

        return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: "Internal server error"
        });
    }
};
