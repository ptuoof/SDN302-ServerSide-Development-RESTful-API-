const mongoose = require('mongoose');
const createError = require('http-errors');
const { Category, Recipe } = require('../models');
const { formatCategory } = require('../utils/serializers');
const { categoryKey } = require('../utils/text');
const { listOrdered, validateCategoryName, uniqueSlug, fallbackCategory } = require('../services/category.service');

// `slug` = URL-friendly identifier generated from the name ("Món chính 🍲" -> "mon-chinh").
// It never changes the display name; it lets clients reference a category in URLs / filters
// without accents or emoji. Clients do not need to send it: it is generated automatically.

const findCategoryOr404 = async id => {
  if (!mongoose.Types.ObjectId.isValid(id)) throw createError(404, 'Không tìm thấy danh mục');
  const category = await Category.findById(id);
  if (!category) throw createError(404, 'Không tìm thấy danh mục');
  return category;
};

const recipeCounts = async () => {
  const rows = await Recipe.aggregate([{ $group: { _id: '$category', count: { $sum: 1 } } }]);
  return new Map(rows.map(row => [String(row._id), row.count]));
};

const listResponse = async () => {
  const [categories, counts] = await Promise.all([listOrdered(), recipeCounts()]);
  const list = categories.map(cat => formatCategory(cat, counts.get(String(cat._id)) || 0));
  return { count: list.length, names: list.map(cat => cat.name), categories: list };
};

// @desc    Get all categories in display order, with the number of recipes in each
// @route   GET /api/categories
// @access  Public
exports.getAllCategories = async (req, res, next) => {
  try {
    res.status(200).json({ success: true, ...(await listResponse()) });
  } catch (error) {
    next(error);
  }
};

// @desc    Create category (added at the end of the list)
// @route   POST /api/categories
// @access  Private (Admin)
// @body    { name, slug?, icon?, order? }
exports.createCategory = async (req, res, next) => {
  try {
    const name = String(req.body.name).trim();
    const error = await validateCategoryName(name);
    if (error) return next(createError(400, error));

    const last = await Category.findOne().sort({ order: -1 });
    const category = await Category.create({
      name,
      slug: await uniqueSlug(req.body.slug || name),
      icon: req.body.icon || undefined,
      order: Number.isInteger(req.body.order) ? req.body.order : (last?.order || 0) + 1
    });
    res.status(201).json({
      success: true,
      message: 'Đã thêm danh mục',
      category: formatCategory(category, 0)
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update category. Renaming keeps every recipe in it (recipes reference the category id).
// @route   PUT /api/categories/:id
// @access  Private (Admin)
// @body    { name?, slug?, icon?, order? }
exports.updateCategory = async (req, res, next) => {
  try {
    const category = await findCategoryOr404(req.params.id);
    const { name, slug, icon, order } = req.body;

    if (name !== undefined) {
      const clean = String(name).trim();
      const error = await validateCategoryName(clean, category._id);
      if (error) return next(createError(400, error));
      const renamed = categoryKey(clean) !== categoryKey(category.name);
      category.name = clean;
      // The slug follows the name unless the client sets one explicitly
      if (renamed && slug === undefined) category.slug = await uniqueSlug(clean, category._id);
    }
    if (slug !== undefined) category.slug = await uniqueSlug(slug, category._id);
    if (icon !== undefined) category.icon = icon;
    if (order !== undefined) category.order = order;

    await category.save();
    const count = await Recipe.countDocuments({ category: category._id });
    res.status(200).json({
      success: true,
      message: 'Đã cập nhật danh mục',
      category: formatCategory(category, count)
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Set the display order of all categories
// @route   PUT /api/categories/reorder
// @access  Private (Admin)
// @body    { ids: [categoryId, ...] }  or  { names: ['Món chính 🍲', ...] }  - every category, in the new order
exports.reorderCategories = async (req, res, next) => {
  try {
    const all = await Category.find();
    const byId = new Map(all.map(cat => [String(cat._id), cat]));
    const byKey = new Map(all.map(cat => [categoryKey(cat.name), cat]));
    const list = Array.isArray(req.body.ids)
      ? req.body.ids.map(id => byId.get(String(id)))
      : req.body.names.map(name => byKey.get(categoryKey(name)));

    const unique = new Set(list.filter(Boolean).map(cat => String(cat._id)));
    if (list.some(cat => !cat) || unique.size !== list.length || unique.size !== all.length) {
      return next(createError(400, 'Danh sách phải chứa đúng tất cả danh mục hiện có, mỗi danh mục một lần'));
    }

    await Category.bulkWrite(list.map((cat, index) => ({
      updateOne: { filter: { _id: cat._id }, update: { $set: { order: index + 1 } } }
    })));

    res.status(200).json({ success: true, message: 'Đã sắp xếp lại danh mục', ...(await listResponse()) });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete category. Its recipes move to the default category ("Món chính 🍲", else the first one).
//          The last remaining category cannot be deleted.
// @route   DELETE /api/categories/:id
// @access  Private (Admin)
exports.deleteCategory = async (req, res, next) => {
  try {
    const category = await findCategoryOr404(req.params.id);
    if ((await Category.countDocuments()) <= 1) {
      return next(createError(400, 'Cần giữ lại ít nhất 1 danh mục.'));
    }

    const target = await fallbackCategory(category._id);
    const moved = await Recipe.updateMany({ category: category._id }, { $set: { category: target._id } });
    await Category.deleteOne({ _id: category._id });

    res.status(200).json({
      success: true,
      message: moved.modifiedCount
        ? `Đã xóa danh mục. ${moved.modifiedCount} công thức được chuyển sang "${target.name}".`
        : 'Đã xóa danh mục',
      deletedId: category._id.toString(),
      movedRecipes: moved.modifiedCount,
      fallbackCategory: formatCategory(target)
    });
  } catch (error) {
    next(error);
  }
};
