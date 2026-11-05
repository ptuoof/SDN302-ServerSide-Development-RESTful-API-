const mongoose = require('mongoose');
const createError = require('http-errors');
const { Favorite, Recipe } = require('../models');
const { formatRecipe } = require('../utils/serializers');
const { canView } = require('../utils/recipeAccess');

// @desc    Get user's favorite recipes (only recipes the user can still see)
// @route   GET /api/favorites
// @access  Private
exports.getFavorites = async (req, res, next) => {
  try {
    const favorites = await Favorite.find({ user: req.user._id })
      .populate({
        path: 'recipe',
        populate: [
          { path: 'category', select: 'name slug icon' },
          { path: 'author', select: 'fullName username avatar role' }
        ]
      })
      .sort({ createdAt: -1 });

    // A recipe made private by its owner (or deleted) disappears from other users' favorites
    const activeFavorites = favorites.filter(f => f.recipe && canView(f.recipe, req.user));
    const recipes = activeFavorites.map(f => formatRecipe(f.recipe, req.user));

    res.status(200).json({
      success: true,
      count: recipes.length,
      favoriteIds: recipes.map(r => r.id),
      recipes
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Toggle favorite status of a recipe
// @route   POST /api/favorites/:recipeId/toggle
// @access  Private
exports.toggleFavorite = async (req, res, next) => {
  try {
    const { recipeId } = req.params;
    const recipe = mongoose.Types.ObjectId.isValid(recipeId) ? await Recipe.findById(recipeId).select('author isPublic type') : null;

    if (!recipe || !canView(recipe, req.user)) {
      return next(createError(404, 'Không tìm thấy công thức'));
    }

    // Atomic operations: remove if exists, otherwise create.
    // likesCount is updated with $inc so concurrent requests stay consistent.
    const removed = await Favorite.findOneAndDelete({
      user: req.user._id,
      recipe: recipeId
    });

    let isFavorite = false;
    let updatedRecipe;

    if (removed) {
      updatedRecipe = await Recipe.findOneAndUpdate(
        { _id: recipeId, likesCount: { $gt: 0 } },
        { $inc: { likesCount: -1 } },
        { new: true }
      );
      isFavorite = false;
    } else {
      // Unique index (user + recipe) rejects duplicates created concurrently
      await Favorite.create({
        user: req.user._id,
        recipe: recipeId
      });
      updatedRecipe = await Recipe.findByIdAndUpdate(
        recipeId,
        { $inc: { likesCount: 1 } },
        { new: true }
      );
      isFavorite = true;
    }

    if (!updatedRecipe) {
      updatedRecipe = await Recipe.findById(recipeId);
    }

    res.status(200).json({
      success: true,
      recipeId,
      isFavorite,
      likesCount: updatedRecipe?.likesCount || 0,
      message: isFavorite ? 'Đã thêm vào yêu thích' : 'Đã bỏ khỏi yêu thích'
    });
  } catch (error) {
    next(error);
  }
};
