const mongoose = require('mongoose');
const createError = require('http-errors');
const { Recipe, Category, Favorite } = require('../models');
const escapeRegex = require('../utils/escapeRegex');

// Fields a recipe owner is allowed to change (prevents mass assignment of
// author, likesCount, isCustom, timestamps... through PUT /api/recipes/:id)
const UPDATABLE_RECIPE_FIELDS = [
  'title',
  'description',
  'imageUrl',
  'videoUrl',
  'prepTimeMinutes',
  'cookTimeMinutes',
  'servings',
  'calories',
  'difficulty',
  'colorAccent',
  'isPublic',
  'ingredients',
  'steps'
];

const MAX_PAGE_LIMIT = 100;

// Helper to format recipe for seamless FE compatibility and SDN302 standards
const formatRecipe = recipe => {
  const obj = recipe.toObject ? recipe.toObject() : { ...recipe };
  const catObj = obj.category && typeof obj.category === 'object' ? obj.category : null;
  const categoryString = catObj
    ? catObj.name
    : typeof obj.category === 'string'
    ? obj.category
    : 'Món chính 🍲';

  const recipeId = obj._id ? obj._id.toString() : obj.id;

  return {
    ...obj,
    id: recipeId,
    _id: recipeId,
    category: categoryString,
    categoryObj: catObj,
    categoryName: categoryString
  };
};

// @desc    Get all recipes with filtering, search, sorting & pagination
// @route   GET /api/recipes
// @access  Public
exports.getAllRecipes = async (req, res, next) => {
  try {
    const {
      category,
      search,
      difficulty,
      maxCalories,
      maxTime,
      sort = '-createdAt',
      page = 1,
      limit = 50
    } = req.query;

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
    if (search && String(search).trim() !== '') {
      const safeSearch = escapeRegex(String(search).trim());
      filter.$or = [
        { title: { $regex: safeSearch, $options: 'i' } },
        { description: { $regex: safeSearch, $options: 'i' } },
        { 'ingredients.name': { $regex: safeSearch, $options: 'i' } }
      ];
    }

    // 3. Difficulty Filter
    if (difficulty && ['Dễ', 'Vừa', 'Khó'].includes(difficulty)) {
      filter.difficulty = difficulty;
    }

    // 4. Calorie Filter
    if (maxCalories && !isNaN(Number(maxCalories))) {
      filter.calories = { $lte: Number(maxCalories) };
    }

    // 5. Total Cook Time Filter
    if (maxTime && !isNaN(Number(maxTime))) {
      filter.$expr = {
        $lte: [{ $add: ['$prepTimeMinutes', '$cookTimeMinutes'] }, Number(maxTime)]
      };
    }

    // Build Sorting Criteria
    let sortCriteria = {};
    if (sort) {
      const parts = sort.split(',');
      parts.forEach(part => {
        if (part.startsWith('-')) {
          sortCriteria[part.substring(1)] = -1;
        } else {
          sortCriteria[part] = 1;
        }
      });
    }

    // Pagination with safe bounds (1 <= limit <= MAX_PAGE_LIMIT)
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 50, 1), MAX_PAGE_LIMIT);
    const skip = (pageNum - 1) * limitNum;

    const [total, recipes] = await Promise.all([
      Recipe.countDocuments(filter),
      Recipe.find(filter)
        .populate('category', 'name slug icon')
        .populate('author', 'fullName username avatar role')
        .sort(sortCriteria)
        .skip(skip)
        .limit(limitNum)
    ]);

    res.status(200).json({
      success: true,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
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

    const authorId = req.user?._id || req.userId;

    const recipe = await Recipe.create({
      title,
      description,
      imageUrl,
      videoUrl: videoUrl || '',
      category: categoryId,
      author: authorId,
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

    const userId = (req.user?._id || req.userId).toString();
    const userRole = req.user?.role || req.role;

    // Check ownership or admin role
    if (recipe.author.toString() !== userId && userRole !== 'admin') {
      return next(createError.Forbidden('You are not authorized to update this recipe'));
    }

    // Only copy whitelisted fields from the request body
    const updates = {};
    UPDATABLE_RECIPE_FIELDS.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });
    if (updates.ingredients !== undefined && !Array.isArray(updates.ingredients)) {
      delete updates.ingredients;
    }
    if (updates.steps !== undefined && !Array.isArray(updates.steps)) {
      delete updates.steps;
    }

    // Resolve category: accept a valid ObjectId or a category name
    const { category, categoryName } = req.body;
    if (typeof category === 'string' && mongoose.Types.ObjectId.isValid(category)) {
      const exists = await Category.exists({ _id: category });
      if (!exists) {
        return next(createError.BadRequest('Category does not exist'));
      }
      updates.category = category;
    } else {
      const nameToFind = categoryName || (typeof category === 'string' ? category : null);
      if (nameToFind) {
        const cat = await Category.findOne({ name: nameToFind });
        if (cat) updates.category = cat._id;
      }
    }

    const updated = await Recipe.findByIdAndUpdate(id, updates, {
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

    const userId = (req.user?._id || req.userId).toString();
    const userRole = req.user?.role || req.role;

    // Check ownership or admin role
    if (recipe.author.toString() !== userId && userRole !== 'admin') {
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
    const authorId = req.user?._id || req.userId;
    const recipes = await Recipe.find({ author: authorId })
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
