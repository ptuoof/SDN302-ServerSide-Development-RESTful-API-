// Category rules shared by the category, recipe and seed code (same rules as src/utils/categories.js in the app).
const mongoose = require('mongoose');
const { Category } = require('../models');
const { categoryKey, slugify } = require('../utils/text');
const { ALL_CATEGORY, PREFERRED_DEFAULT_CATEGORY, CATEGORY_NAME_MAX } = require('../config/limits');

/** Categories in display order. */
const listOrdered = () => Category.find().sort({ order: 1, createdAt: 1 });

/**
 * Checks a new or renamed category name. Returns an error message, or null when valid.
 * `currentId` is the category being renamed (it may keep its own name).
 */
const validateCategoryName = async (name, currentId = null) => {
  const clean = String(name ?? '').trim();
  const key = categoryKey(clean);
  if (!key) return 'Tên danh mục không được để trống.';
  if (clean.length > CATEGORY_NAME_MAX) return `Tên danh mục tối đa ${CATEGORY_NAME_MAX} ký tự.`;
  if (key === categoryKey(ALL_CATEGORY)) return '"Tất cả" là tên dành riêng cho bộ lọc.';
  const all = await Category.find().select('name');
  if (all.some(cat => String(cat._id) !== String(currentId) && categoryKey(cat.name) === key)) {
    return 'Danh mục này đã tồn tại.';
  }
  return null;
};

/** A slug not used by another category: "mon-chinh", "mon-chinh-2"... */
const uniqueSlug = async (source, currentId = null) => {
  const base = slugify(source) || 'danh-muc';
  let slug = base;
  for (let n = 2; ; n += 1) {
    const taken = await Category.exists({ slug, ...(currentId ? { _id: { $ne: currentId } } : {}) });
    if (!taken) return slug;
    slug = `${base}-${n}`;
  }
};

/** Category used when a recipe's category is unknown or was deleted. */
const fallbackCategory = async (excludeId = null) => {
  const list = (await listOrdered()).filter(cat => String(cat._id) !== String(excludeId));
  return list.find(cat => categoryKey(cat.name) === categoryKey(PREFERRED_DEFAULT_CATEGORY)) || list[0] || null;
};

/**
 * Resolves what the app sends as a recipe category: an id, or a name compared like the app does
 * ("mon chinh" -> "Món chính 🍲"). Unknown values fall back to the default category, like
 * normalizeCategory() in the app. Returns the Category doc or null when there is no category at all.
 */
const resolveCategory = async value => {
  if (value && typeof value === 'object') value = value._id || value.id || value.name;
  const text = value == null ? '' : String(value).trim();
  if (text && mongoose.Types.ObjectId.isValid(text)) {
    const byId = await Category.findById(text);
    if (byId) return byId;
  }
  if (text) {
    const key = categoryKey(text);
    const byName = (await Category.find()).find(cat => categoryKey(cat.name) === key || cat.slug === text);
    if (byName) return byName;
  }
  return fallbackCategory();
};

module.exports = { listOrdered, validateCategoryName, uniqueSlug, fallbackCategory, resolveCategory };
