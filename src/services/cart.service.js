import Cart from "../models/cart.model.js";

export const mergeGuestCartIntoUser = async (guestId, userId) => {
    if (!guestId) return;

    const guestCart = await Cart.findOne({ guestId });

    if (!guestCart || guestCart.items.length === 0) {
        if (guestCart) await guestCart.deleteOne();
        return;
    }

    let userCart = await Cart.findOne({ user: userId });

    // User doesn't have a cart yet — convert guest cart into user cart
    if (!userCart) {
        guestCart.user = userId;
        guestCart.guestId = null;

        await guestCart.save();
        return;
    }

    // Merge guest items into existing user cart
    for (const guestItem of guestCart.items) {
        const existingItem = userCart.items.find(
            (item) =>
                item.product.toString() === guestItem.product.toString() &&
                item.variantId.toString() === guestItem.variantId.toString()
        );

        if (existingItem) {
            existingItem.quantity += guestItem.quantity;
        } else {
            userCart.items.push(guestItem);
        }
    }

    await userCart.save();
    await guestCart.deleteOne();
};