const createError = require('http-errors');
const { Favorite, Recipe } = require('../models');

// @desc    Get user's favorite recipes
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

    const activeFavorites = favorites.filter(f => f.recipe !== null);
    const favoriteIds = activeFavorites.map(f => f.recipe._id.toString());
    const recipes = activeFavorites.map(f => {
      const obj = f.recipe.toObject();
      return {
        ...obj,
        id: obj._id.toString(),
        categoryName: obj.category?.name || 'Món chính 🍲'
      };
    });

    res.status(200).json({
      success: true,
      count: recipes.length,
      favoriteIds,
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
    const recipeExists = await Recipe.exists({ _id: recipeId });

    if (!recipeExists) {
      return next(createError.NotFound('Recipe not found'));
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
      message: isFavorite ? 'Added to favorites' : 'Removed from favorites'
    });
  } catch (error) {
    next(error);
  }
};
