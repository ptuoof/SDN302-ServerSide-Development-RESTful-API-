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
    const recipe = await Recipe.findById(recipeId);

    if (!recipe) {
      return next(createError.NotFound('Recipe not found'));
    }

    const existing = await Favorite.findOne({
      user: req.user._id,
      recipe: recipeId
    });

    let isFavorite = false;

    if (existing) {
      await Favorite.findByIdAndDelete(existing._id);
      recipe.likesCount = Math.max(0, (recipe.likesCount || 1) - 1);
      await recipe.save();
      isFavorite = false;
    } else {
      await Favorite.create({
        user: req.user._id,
        recipe: recipeId
      });
      recipe.likesCount = (recipe.likesCount || 0) + 1;
      await recipe.save();
      isFavorite = true;
    }

    res.status(200).json({
      success: true,
      recipeId,
      isFavorite,
      likesCount: recipe.likesCount,
      message: isFavorite ? 'Added to favorites' : 'Removed from favorites'
    });
  } catch (error) {
    next(error);
  }
};
