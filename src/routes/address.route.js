import express from "express";

import { authenticate } from "../../src/middleware/authMiiddleware.js";

import {
    getAddresses,
    addAddress,
    updateAddress,
    deleteAddress
} from "../../src/controllers/address/address.controller.js";

const router = express.Router();

// All address routes require an authenticated customer
router.use(authenticate);

// Get all saved addresses
router.get("/", getAddresses);

// Add a new address
router.post("/", addAddress);

// Update an existing address
router.patch("/:addressId", updateAddress);

// Delete an existing address
router.delete("/:addressId", deleteAddress);

export default router;