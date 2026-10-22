const mongoose = require('mongoose');
const createError = require('http-errors');
const { Recipe, Category, Favorite } = require('../models');

// Helper to format recipe for FE compatibility
const formatRecipe = recipe => {
  const obj = recipe.toObject ? recipe.toObject() : { ...recipe };
  return {
    ...obj,
    id: obj._id.toString(),
    categoryName: obj.category?.name || 'Món chính 🍲'
  };
};

// @desc    Get all recipes with filtering & search
// @route   GET /api/recipes
// @access  Public
exports.getAllRecipes = async (req, res, next) => {
  try {
    const { category, search, page = 1, limit = 50 } = req.query;
    const filter = {};

    // 1. Category Filter
    if (category && category !== 'Tất cả') {
      if (mongoose.Types.ObjectId.isValid(category)) {
        filter.category = category;
      } else {
        const foundCategory = await Category.findOne({ name: category });
        if (foundCategory) {
          filter.category = foundCategory._id;
        }
      }
    }

    // 2. Search Query (Title, Description, or Ingredients)
    if (search && search.trim() !== '') {
      filter.$or = [
        { title: { $regex: search.trim(), $options: 'i' } },
        { description: { $regex: search.trim(), $options: 'i' } },
        { 'ingredients.name': { $regex: search.trim(), $options: 'i' } }
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [total, recipes] = await Promise.all([
      Recipe.countDocuments(filter),
      Recipe.find(filter)
        .populate('category', 'name slug icon')
        .populate('author', 'fullName username avatar role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
    ]);

    res.status(200).json({
      success: true,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit)),
      recipes: recipes.map(formatRecipe)
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single recipe by ID
// @route   GET /api/recipes/:id
// @access  Public
exports.getRecipeById = async (req, res, next) => {
  try {
    const { id } = req.params;
    let recipe;

    if (mongoose.Types.ObjectId.isValid(id)) {
      recipe = await Recipe.findById(id)
        .populate('category', 'name slug icon')
        .populate('author', 'fullName username avatar role');
    }

    if (!recipe) {
      return next(createError.NotFound('Recipe not found'));
    }

    res.status(200).json({
      success: true,
      recipe: formatRecipe(recipe)
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new recipe
// @route   POST /api/recipes
// @access  Private
exports.createRecipe = async (req, res, next) => {
  try {
    const {
      title,
      description,
      imageUrl,
      videoUrl,
      category,
      categoryName,
      prepTimeMinutes,
      cookTimeMinutes,
      servings,
      calories,
      difficulty,
      colorAccent,
      ingredients,
      steps
    } = req.body;

    if (!title || !description || !imageUrl) {
      return next(createError.BadRequest('Title, description, and image URL are required'));
    }

    // Resolve Category ID
    let categoryId = category;
    if (!categoryId || !mongoose.Types.ObjectId.isValid(categoryId)) {
      const targetCatName = categoryName || category || 'Món nhanh ⚡';
      let foundCat = await Category.findOne({ name: targetCatName });
      if (!foundCat) {
        foundCat = await Category.findOne();
      }
      categoryId = foundCat ? foundCat._id : null;
    }

    if (!categoryId) {
      return next(createError.BadRequest('Valid category is required'));
    }

    const recipe = await Recipe.create({
      title,
      description,
      imageUrl,
      videoUrl: videoUrl || '',
      category: categoryId,
      author: req.user._id,
      prepTimeMinutes: Number(prepTimeMinutes) || 10,
      cookTimeMinutes: Number(cookTimeMinutes) || 15,
      servings: Number(servings) || 2,
      calories: Number(calories) || 250,
      difficulty: difficulty || 'Dễ',
      colorAccent: colorAccent || '#FF6B6B',
      isCustom: true,
      isPublic: true,
      ingredients: Array.isArray(ingredients) ? ingredients : [],
      steps: Array.isArray(steps) ? steps : []
    });

    const populated = await Recipe.findById(recipe._id)
      .populate('category', 'name slug icon')
      .populate('author', 'fullName username avatar role');

    res.status(201).json({
      success: true,
      message: 'Recipe created successfully',
      recipe: formatRecipe(populated)
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update recipe
// @route   PUT /api/recipes/:id
// @access  Private
exports.updateRecipe = async (req, res, next) => {
  try {
    const { id } = req.params;
    const recipe = await Recipe.findById(id);

    if (!recipe) {
      return next(createError.NotFound('Recipe not found'));
    }

    // Check ownership or admin role
    if (recipe.author.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return next(createError.Forbidden('You are not authorized to update this recipe'));
    }

    // Handle category name update if provided
    if (req.body.categoryName && !req.body.category) {
      const cat = await Category.findOne({ name: req.body.categoryName });
      if (cat) req.body.category = cat._id;
    }

    const updated = await Recipe.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true
    })
      .populate('category', 'name slug icon')
      .populate('author', 'fullName username avatar role');

    res.status(200).json({
      success: true,
      message: 'Recipe updated successfully',
      recipe: formatRecipe(updated)
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete recipe
// @route   DELETE /api/recipes/:id
// @access  Private
exports.deleteRecipe = async (req, res, next) => {
  try {
    const { id } = req.params;
    const recipe = await Recipe.findById(id);

    if (!recipe) {
      return next(createError.NotFound('Recipe not found'));
    }

    // Check ownership or admin role
    if (recipe.author.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return next(createError.Forbidden('You are not authorized to delete this recipe'));
    }

    await Promise.all([
      Recipe.findByIdAndDelete(id),
      Favorite.deleteMany({ recipe: id })
    ]);

    res.status(200).json({
      success: true,
      message: 'Recipe deleted successfully',
      deletedId: id
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get recipes created by current user
// @route   GET /api/recipes/my/created
// @access  Private
exports.getMyRecipes = async (req, res, next) => {
  try {
    const recipes = await Recipe.find({ author: req.user._id })
      .populate('category', 'name slug icon')
      .populate('author', 'fullName username avatar role')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: recipes.length,
      recipes: recipes.map(formatRecipe)
    });
  } catch (error) {
    next(error);
  }
};
