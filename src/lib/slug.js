import Collection from "../models/collection.model.js";

const slugify = (text) =>
    text
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");

export const generateUniqueSlug = async (name) => {
    const base = slugify(name);
    let slug = base;
    let counter = 1;

    while (await Collection.findOne({ slug })) {
        slug = `${base}-${counter}`;
        counter++;
    }

    return slug;
};