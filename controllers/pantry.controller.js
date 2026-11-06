const { Recipe } = require('../models');
const { normalizeVi } = require('../utils/text');
const { formatRecipe } = require('../utils/serializers');
const { visibilityFilter } = require('../utils/recipeAccess');
const pantry = require('../services/pantry.service');

const namesFrom = body => (Array.isArray(body?.names) ? body.names : [body?.ingredientName]);

// Names are compared without accents/case, like the app ("hanh la" === "Hành lá").

// @desc    Get user's pantry ingredients (in the order they were added)
// @route   GET /api/pantry
// @access  Private
exports.getPantry = async (req, res, next) => {
  try {
    const ingredients = await pantry.listNames(req.user._id);
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
// @body    { ingredientName }
exports.togglePantryItem = async (req, res, next) => {
  try {
    const ingredientName = String(req.body.ingredientName).trim();
    const action = await pantry.toggleName(req.user._id, ingredientName);
    res.status(200).json({
      success: true,
      action,
      ingredientName,
      ingredients: await pantry.listNames(req.user._id)
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Add ingredients (already-present names are skipped, never toggled off)
// @route   POST /api/pantry
// @access  Private
// @body    { ingredientName } or { names: [...] }
exports.addPantryItems = async (req, res, next) => {
  try {
    const added = await pantry.addNames(req.user._id, namesFrom(req.body));
    res.status(added.length ? 201 : 200).json({
      success: true,
      added,
      ingredients: await pantry.listNames(req.user._id)
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Remove several ingredients at once (e.g. used up by a cooked dish)
// @route   POST /api/pantry/remove
// @access  Private
// @body    { ingredientName } or { names: [...] }
exports.removePantryItems = async (req, res, next) => {
  try {
    const removed = await pantry.removeNames(req.user._id, namesFrom(req.body));
    res.status(200).json({
      success: true,
      removedCount: removed,
      ingredients: await pantry.listNames(req.user._id)
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
    await pantry.removeNames(req.user._id, await pantry.listNames(req.user._id));
    res.status(200).json({
      success: true,
      message: 'Đã dọn sạch kho nguyên liệu',
      ingredients: []
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Suggest recipes (visible to the user) based on pantry ingredients
// @route   GET /api/pantry/suggest-recipes
// @access  Private
// Note: the app has its own, richer matcher (staples + allergies); this endpoint is kept for other clients.
exports.suggestRecipes = async (req, res, next) => {
  try {
    const pantryNames = (await pantry.listNames(req.user._id)).map(normalizeVi);

    if (pantryNames.length === 0) {
      return res.status(200).json({
        success: true,
        readyToCook: [],
        missingFew: []
      });
    }

    const allRecipes = await Recipe.find(visibilityFilter(req.user))
      .populate('category', 'name slug icon')
      .populate('author', 'fullName username avatar role');

    const scored = allRecipes.map(recipe => {
      const totalIngs = recipe.ingredients.length;
      const matched = [];
      const missing = [];

      recipe.ingredients.forEach(ing => {
        const ingKey = normalizeVi(ing.name);
        const has = pantryNames.some(pName => ingKey.includes(pName) || pName.includes(ingKey));
        (has ? matched : missing).push(ing.name);
      });

      return {
        recipe: formatRecipe(recipe, req.user),
        matchedCount: matched.length,
        totalIngredients: totalIngs,
        matchRatio: totalIngs ? Math.round((matched.length / totalIngs) * 100) : 0,
        missing
      };
    });

    scored.sort((a, b) => b.matchRatio - a.matchRatio);

    res.status(200).json({
      success: true,
      readyToCook: scored.filter(s => s.matchRatio >= 80),
      missingFew: scored.filter(s => s.matchRatio >= 40 && s.matchRatio < 80)
    });
  } catch (error) {
    next(error);
  }
};
