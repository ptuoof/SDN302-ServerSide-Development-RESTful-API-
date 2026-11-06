const mongoose = require('mongoose');
const createError = require('http-errors');
const { ShoppingItem } = require('../models');
const { formatShoppingItem } = require('../utils/serializers');
const { normalizeUnit } = require('../utils/units');
const { DEFAULT_AMOUNT } = require('../config/limits');
const { mergeIntoShoppingList, setChecked } = require('../services/shopping.service');
const pantry = require('../services/pantry.service');

const findItemOr404 = async (userId, id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) throw createError(404, 'Không tìm thấy món trong danh sách mua sắm');
  const item = await ShoppingItem.findOne({ _id: id, user: userId });
  if (!item) throw createError(404, 'Không tìm thấy món trong danh sách mua sắm');
  return item;
};

/** Adds the pantry list to a response when ticking a row changed it (autoStockPantry). */
const withPantry = async (userId, pantryChanged) => (pantryChanged ? { pantry: await pantry.listNames(userId) } : {});

// @desc    Get user's shopping list (newest first)
// @route   GET /api/shopping
// @access  Private
exports.getShoppingList = async (req, res, next) => {
  try {
    const items = await ShoppingItem.find({ user: req.user._id }).sort({ createdAt: -1, _id: -1 });
    res.status(200).json({
      success: true,
      count: items.length,
      items: items.map(formatShoppingItem)
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Add one item bought freely ("Mua tự do"). Merges with an unchecked row of the same name.
// @route   POST /api/shopping
// @access  Private
// @body    { name, amount? ("1"), unit? ("phần"), recipeTitle? ("Mua tự do") }
exports.addCustomItem = async (req, res, next) => {
  try {
    const { name, amount, unit, recipeTitle } = req.body;
    const result = await mergeIntoShoppingList(
      req.user._id,
      [{ name, amount: String(amount ?? '').trim() || '1', unit: String(unit ?? '').trim() || 'phần' }],
      String(recipeTitle ?? '').trim() || 'Mua tự do'
    );
    res.status(result.added ? 201 : 200).json({
      success: true,
      added: result.added,
      merged: result.merged,
      item: formatShoppingItem(result.items[0])
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Add the ingredients of a recipe / the meal plan. Rows with the same name are merged
//          (same unit, g+kg, ml+lít, or the same text such as "Vừa đủ") instead of duplicated.
// @route   POST /api/shopping/bulk
// @access  Private
// @body    { ingredients: [{ name, amount, unit }], recipeTitle? }
exports.addBulkFromRecipe = async (req, res, next) => {
  try {
    const { ingredients, recipeTitle } = req.body;
    const result = await mergeIntoShoppingList(req.user._id, ingredients, String(recipeTitle ?? '').trim() || 'Công thức CookFlow');
    res.status(201).json({
      success: true,
      count: result.items.length,
      added: result.added,
      merged: result.merged,
      items: result.items.map(formatShoppingItem)
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Put a deleted row back exactly as it was (undo). No merging.
// @route   POST /api/shopping/restore
// @access  Private
// @body    { name, amount, unit, recipeTitle, checked, stockedToPantry }
exports.restoreItem = async (req, res, next) => {
  try {
    const { name, amount, unit, recipeTitle, checked, stockedToPantry } = req.body;
    const item = await ShoppingItem.create({
      user: req.user._id,
      name: String(name).trim(),
      amount: String(amount ?? '').trim() || DEFAULT_AMOUNT,
      unit: normalizeUnit(unit),
      recipeTitle: String(recipeTitle ?? '').trim() || 'Mua tự do',
      checked: checked === true,
      stockedToPantry: stockedToPantry === true
    });
    res.status(201).json({ success: true, item: formatShoppingItem(item) });
  } catch (error) {
    next(error);
  }
};

// @desc    Edit a row (name / amount / unit) and/or set its bought state
// @route   PATCH /api/shopping/:id
// @access  Private
// @body    { name?, amount?, unit?, checked? }  - empty amount becomes "Vừa đủ"
exports.updateItem = async (req, res, next) => {
  try {
    const item = await findItemOr404(req.user._id, req.params.id);
    const { name, amount, unit, checked } = req.body;

    if (name !== undefined) item.name = String(name).trim();
    if (amount !== undefined) item.amount = String(amount ?? '').trim() || DEFAULT_AMOUNT;
    if (unit !== undefined) item.unit = normalizeUnit(unit);

    let pantryChanged = false;
    if (typeof checked === 'boolean') {
      ({ pantryChanged } = await setChecked(req.user, item, checked));
    } else {
      await item.save();
    }

    res.status(200).json({
      success: true,
      item: formatShoppingItem(item),
      ...(await withPantry(req.user._id, pantryChanged))
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Toggle item checked status (with autoStockPantry, buying puts the item in the pantry)
// @route   PATCH /api/shopping/:id/toggle
// @access  Private
exports.toggleItem = async (req, res, next) => {
  try {
    const item = await findItemOr404(req.user._id, req.params.id);
    const { pantryChanged } = await setChecked(req.user, item, !item.checked);

    res.status(200).json({
      success: true,
      item: formatShoppingItem(item),
      ...(await withPantry(req.user._id, pantryChanged))
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete single item. Returns the deleted row so the app can offer "Hoàn tác" (POST /restore).
// @route   DELETE /api/shopping/:id
// @access  Private
exports.deleteItem = async (req, res, next) => {
  try {
    const item = await findItemOr404(req.user._id, req.params.id);
    await item.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Đã xóa khỏi danh sách mua sắm',
      deletedId: req.params.id,
      item: formatShoppingItem(item)
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Clear all checked items
// @route   DELETE /api/shopping/clear-checked
// @access  Private
exports.clearCheckedItems = async (req, res, next) => {
  try {
    const result = await ShoppingItem.deleteMany({
      user: req.user._id,
      checked: true
    });

    res.status(200).json({
      success: true,
      message: 'Đã xóa các món đã mua',
      deletedCount: result.deletedCount
    });
  } catch (error) {
    next(error);
  }
};
