const createError = require('http-errors');
const { ShoppingItem } = require('../models');

// Helper to format item for FE
const formatItem = item => ({
  id: item._id.toString(),
  _id: item._id,
  name: item.name,
  amount: item.amount,
  unit: item.unit,
  recipeTitle: item.recipeTitle,
  checked: item.checked,
  createdAt: item.createdAt
});

// @desc    Get user's shopping list
// @route   GET /api/shopping
// @access  Private
exports.getShoppingList = async (req, res, next) => {
  try {
    const items = await ShoppingItem.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      count: items.length,
      items: items.map(formatItem)
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Add single custom item to shopping list
// @route   POST /api/shopping
// @access  Private
exports.addCustomItem = async (req, res, next) => {
  try {
    const { name, amount, unit, recipeTitle } = req.body;
    if (!name || !name.trim()) {
      return next(createError.BadRequest('Item name is required'));
    }

    const item = await ShoppingItem.create({
      user: req.user._id,
      name: name.trim(),
      amount: amount?.trim() || '1',
      unit: unit?.trim() || 'phần',
      recipeTitle: recipeTitle?.trim() || 'Mua tự do',
      checked: false
    });

    res.status(201).json({
      success: true,
      item: formatItem(item)
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Add bulk ingredients from a recipe
// @route   POST /api/shopping/bulk
// @access  Private
exports.addBulkFromRecipe = async (req, res, next) => {
  try {
    const { ingredients, recipeTitle } = req.body;
    if (!Array.isArray(ingredients) || ingredients.length === 0) {
      return next(createError.BadRequest('Ingredients array is required'));
    }

    const docs = ingredients.map(ing => ({
      user: req.user._id,
      name: ing.name,
      amount: ing.amount || '1',
      unit: ing.unit || 'phần',
      recipeTitle: recipeTitle || 'Công thức CookFlow',
      checked: false
    }));

    const createdItems = await ShoppingItem.insertMany(docs);

    res.status(201).json({
      success: true,
      count: createdItems.length,
      items: createdItems.map(formatItem)
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Toggle item checked status
// @route   PATCH /api/shopping/:id/toggle
// @access  Private
exports.toggleItem = async (req, res, next) => {
  try {
    const item = await ShoppingItem.findOne({
      _id: req.params.id,
      user: req.user._id
    });

    if (!item) {
      return next(createError.NotFound('Shopping item not found'));
    }

    item.checked = !item.checked;
    await item.save();

    res.status(200).json({
      success: true,
      item: formatItem(item)
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete single item
// @route   DELETE /api/shopping/:id
// @access  Private
exports.deleteItem = async (req, res, next) => {
  try {
    const item = await ShoppingItem.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id
    });

    if (!item) {
      return next(createError.NotFound('Shopping item not found'));
    }

    res.status(200).json({
      success: true,
      message: 'Item deleted successfully',
      deletedId: req.params.id
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
      message: 'Checked items cleared successfully',
      deletedCount: result.deletedCount
    });
  } catch (error) {
    next(error);
  }
};
