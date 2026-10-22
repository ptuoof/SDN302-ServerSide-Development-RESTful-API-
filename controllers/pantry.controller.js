const createError = require('http-errors');
const { PantryItem, Recipe } = require('../models');

// @desc    Get user's pantry ingredients
// @route   GET /api/pantry
// @access  Private
exports.getPantry = async (req, res, next) => {
  try {
    const items = await PantryItem.find({ user: req.user._id }).sort({ createdAt: -1 });
    const ingredients = items.map(item => item.ingredientName);

    res.status(200).json({
      success: true,
      count: ingredients.length,
      ingredients
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Toggle ingredient in pantry
// @route   POST /api/pantry/toggle
// @access  Private
exports.togglePantryItem = async (req, res, next) => {
  try {
    const { ingredientName } = req.body;
    if (!ingredientName || !ingredientName.trim()) {
      return next(createError.BadRequest('Ingredient name is required'));
    }

    const trimmedName = ingredientName.trim();
    const existing = await PantryItem.findOne({
      user: req.user._id,
      ingredientName: { $regex: new RegExp(`^${trimmedName}$`, 'i') }
    });

    let action = '';
    if (existing) {
      await PantryItem.findByIdAndDelete(existing._id);
      action = 'removed';
    } else {
      await PantryItem.create({
        user: req.user._id,
        ingredientName: trimmedName
      });
      action = 'added';
    }

    const allItems = await PantryItem.find({ user: req.user._id });
    const ingredients = allItems.map(item => item.ingredientName);

    res.status(200).json({
      success: true,
      action,
      ingredientName: trimmedName,
      ingredients
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Clear user's pantry
// @route   DELETE /api/pantry
// @access  Private
exports.clearPantry = async (req, res, next) => {
  try {
    await PantryItem.deleteMany({ user: req.user._id });
    res.status(200).json({
      success: true,
      message: 'Pantry cleared successfully',
      ingredients: []
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Suggest recipes based on pantry ingredients
// @route   GET /api/pantry/suggest-recipes
// @access  Private
exports.suggestRecipes = async (req, res, next) => {
  try {
    const pantryItems = await PantryItem.find({ user: req.user._id });
    const pantryNames = pantryItems.map(p => p.ingredientName.toLowerCase());

    const allRecipes = await Recipe.find()
      .populate('category', 'name slug icon')
      .populate('author', 'fullName username avatar role');

    if (pantryNames.length === 0) {
      return res.status(200).json({
        success: true,
        readyToCook: [],
        missingFew: []
      });
    }

    const scored = allRecipes.map(recipe => {
      const totalIngs = recipe.ingredients.length;
      if (totalIngs === 0) return { recipe, matchRatio: 0, missing: [] };

      const matched = [];
      const missing = [];

      recipe.ingredients.forEach(ing => {
        const ingLower = ing.name.toLowerCase();
        const has = pantryNames.some(
          pName => ingLower.includes(pName) || pName.includes(ingLower)
        );
        if (has) {
          matched.push(ing.name);
        } else {
          missing.push(ing.name);
        }
      });

      const matchRatio = Math.round((matched.length / totalIngs) * 100);
      return {
        recipe: {
          ...recipe.toObject(),
          id: recipe._id.toString(),
          categoryName: recipe.category?.name || 'Món chính 🍲'
        },
        matchedCount: matched.length,
        totalIngredients: totalIngs,
        matchRatio,
        missing
      };
    });

    scored.sort((a, b) => b.matchRatio - a.matchRatio);

    const readyToCook = scored.filter(s => s.matchRatio >= 80);
    const missingFew = scored.filter(s => s.matchRatio >= 40 && s.matchRatio < 80);

    res.status(200).json({
      success: true,
      readyToCook,
      missingFew
    });
  } catch (error) {
    next(error);
  }
};
