import Product from "../models/product.model.js";

export const generateUniqueSKU = async()=>{

    let sku;
    let exists = true;

    while(exists){
        const randomPart = Math.random()
            .toString(36)
            .substring(2, 8)
            .toUpperCase()

        sku = `SKU-${randomPart}`

        exists = await Product.exists({
            "variants.sku":sku
        })
    }
    return sku;
}