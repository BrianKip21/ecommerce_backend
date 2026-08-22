import mongoose from "mongoose";

const cartItemSchema = new mongoose.Schema({
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
        required:true
    },
    variantId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    sku: {
        type: String,
        required: true
    },
    quantity: {
        type: Number,
        required: true,
        min: 1
    }

},
{ timestamps: true }
)

const cartSchema = new mongoose.Schema({
    user: {
        type:mongoose.Schema.Types.ObjectId,
        ref:"User",
        default: null
    },
    guestId: {
        type: String,
        default: null
    },
    items: [cartItemSchema]
}, 
    {timestamps: true}
)

// One cart per logged-in user
cartSchema.index(
    { user: 1},
    { unique: true, partialFilterExpression: { user: {$type: "objectId"}}}
)

// One cart per logged-in guest
cartSchema.index(
    { guestId: 1},
    { unique: true, partialFilterExpression: { guestId: {$type: "String"}}}
)

const Cart = mongoose.model("Cart", cartSchema)
export default Cart;