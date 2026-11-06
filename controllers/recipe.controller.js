const mongoose = require('mongoose');
const createError = require('http-errors');
const { Recipe, Category, Favorite } = require('../models');
const escapeRegex = require('../utils/escapeRegex');
const { tokensOf, categoryKey } = require('../utils/text');
const { formatRecipe } = require('../utils/serializers');
const { buildRecipeFields } = require('../utils/recipeInput');
const { visibilityFilter, canView, canEdit } = require('../utils/recipeAccess');
const { resolveCategory } = require('../services/category.service');
const { DIFFICULTIES, RECIPE_TYPES, DIET_TAGS } = require('../config/limits');

const MAX_PAGE_LIMIT = 100;
const SORTABLE_FIELDS = ['createdAt', 'updatedAt', 'title', 'calories', 'prepTimeMinutes', 'cookTimeMinutes', 'servings', 'likesCount', 'difficulty'];

const populateRecipe = query => query
  .populate('category', 'name slug icon')
  .populate('author', 'fullName username avatar role');

const findRecipeOr404 = async id => {
  if (!mongoose.Types.ObjectId.isValid(id)) throw createError(404, 'Không tìm thấy công thức');
  const recipe = await Recipe.findById(id);
  if (!recipe) throw createError(404, 'Không tìm thấy công thức');
  return recipe;
};

/**
 * Recipe type requested by the client. The app sends { system: true } for an admin catalog recipe
 * (addRecipe(data, { system: true })); `type` may also be sent explicitly.
 * Only admins may create / change system and admin recipes.
 */
const requestedType = body => {
  if (RECIPE_TYPES.includes(body.type)) return body.type;
  if (body.system === true) return 'admin';
  return null;
};

// @desc    Get recipes visible to the caller, with filtering, search, sorting & pagination
// @route   GET /api/recipes
// @access  Public (signed-in users also see their own private recipes; admins see everything)
// @query   category (id or name), search, difficulty, maxCalories, maxTime, tag, type (system|admin|personal),
//          mine=true (only my recipes), sort (-createdAt), page, limit (max 100)
exports.getAllRecipes = async (req, res, next) => {
  try {
    const {
      category,
      search,
      difficulty,
      maxCalories,
      maxTime,
      tag,
      type,
      mine,
      sort = '-createdAt',
      page = 1,
      limit = 50
    } = req.query;

    const conditions = [visibilityFilter(req.user)];

    // 1. Category Filter (id, or name compared without accents/emoji like the app)
    if (category && category !== 'Tất cả') {
      if (mongoose.Types.ObjectId.isValid(category)) {
        conditions.push({ category });
      } else {
        const key = categoryKey(category);
        const found = (await Category.find()).find(cat => categoryKey(cat.name) === key || cat.slug === category);
        // Unknown category -> no result (instead of silently ignoring the filter)
        conditions.push({ category: found ? found._id : null });
      }
    }

    // 2. Search: every word must start a word of the title, description, tags or ingredients,
    //    ignoring accents ("ca rot" finds "Cà rốt"), like matchesSearch() in the app
    tokensOf(search).forEach(word => {
      conditions.push({ searchText: { $regex: `(^|[^a-z0-9])${escapeRegex(word)}`, $options: 'i' } });
    });

    // 3. Difficulty / tag / type
    if (difficulty && DIFFICULTIES.includes(difficulty)) conditions.push({ difficulty });
    if (tag && DIET_TAGS.includes(tag)) conditions.push({ tags: tag });
    if (type && RECIPE_TYPES.includes(type)) conditions.push({ type });
    if (mine === 'true' && req.user) conditions.push({ author: req.user._id });

    // 4. Calorie Filter
    if (maxCalories && !isNaN(Number(maxCalories))) {
      conditions.push({ calories: { $ne: null, $lte: Number(maxCalories) } });
    }

    // 5. Total Cook Time Filter
    if (maxTime && !isNaN(Number(maxTime))) {
      conditions.push({ $expr: { $lte: [{ $add: ['$prepTimeMinutes', '$cookTimeMinutes'] }, Number(maxTime)] } });
    }

    const filter = { $and: conditions };

    // Sorting (only known fields)
    const sortCriteria = {};
    String(sort).split(',').forEach(part => {
      const field = part.replace(/^-/, '').trim();
      if (SORTABLE_FIELDS.includes(field)) sortCriteria[field] = part.startsWith('-') ? -1 : 1;
    });
    if (!Object.keys(sortCriteria).length) sortCriteria.createdAt = -1;
    sortCriteria._id = sortCriteria._id || -1;

    // Pagination with safe bounds (1 <= limit <= MAX_PAGE_LIMIT)
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 50, 1), MAX_PAGE_LIMIT);
    const skip = (pageNum - 1) * limitNum;

    const [total, recipes] = await Promise.all([
      Recipe.countDocuments(filter),
      populateRecipe(Recipe.find(filter)).sort(sortCriteria).skip(skip).limit(limitNum)
    ]);

    res.status(200).json({
      success: true,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
      recipes: recipes.map(r => formatRecipe(r, req.user))
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single recipe by ID
// @route   GET /api/recipes/:id
// @access  Public (private recipes: owner + admin only - others get 404)
exports.getRecipeById = async (req, res, next) => {
  try {
    const recipe = await findRecipeOr404(req.params.id);
    if (!canView(recipe, req.user)) {
      return next(createError(404, 'Không tìm thấy công thức'));
    }
    const full = await populateRecipe(Recipe.findById(recipe._id));
    res.status(200).json({ success: true, recipe: formatRecipe(full, req.user) });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new recipe
// @route   POST /api/recipes
// @access  Private
// @body    recipe fields as sent by the app (title, description, imageUrl, videoUrl, category (name or id),
//          prepTimeMinutes, cookTimeMinutes, servings, calories, nutrition, difficulty, tags, colorAccent,
//          ingredients[], steps[], copiedFrom, variantOf, aiChanges[], isPublic)
//          + type ('personal' default; 'admin' / 'system' admin only) or system:true (= type 'admin')
exports.createRecipe = async (req, res, next) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const type = requestedType(req.body) || 'personal';
    if (type !== 'personal' && !isAdmin) {
      return next(createError(403, 'Chỉ quản trị viên được thêm công thức vào kho công thức chung', { code: 'FORBIDDEN' }));
    }

    const fields = buildRecipeFields(req.body);
    const category = await resolveCategory(req.body.categoryId || req.body.category || req.body.categoryName);
    if (!category) {
      return next(createError(400, 'Chưa có danh mục nào. Hãy tạo danh mục trước.'));
    }

    const recipe = await Recipe.create({
      ...fields,
      category: category._id,
      author: req.user._id,
      type,
      // personal recipes are private unless the owner shares them; catalog recipes are public
      isPublic: typeof fields.isPublic === 'boolean' ? fields.isPublic : type !== 'personal'
    });

    const populated = await populateRecipe(Recipe.findById(recipe._id));
    res.status(201).json({
      success: true,
      message: type === 'personal' ? 'Đã lưu công thức của bạn' : 'Đã thêm vào kho công thức',
      recipe: formatRecipe(populated, req.user)
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update recipe (partial: only the fields sent are changed)
// @route   PUT /api/recipes/:id   (PATCH is accepted too)
// @access  Private: owner of a personal recipe, or admin (system/admin recipes: admin only)
exports.updateRecipe = async (req, res, next) => {
  try {
    const recipe = await findRecipeOr404(req.params.id);
    if (!canEdit(recipe, req.user)) {
      // Do not reveal private recipes of other users
      if (!canView(recipe, req.user)) return next(createError(404, 'Không tìm thấy công thức'));
      return next(createError(403, 'Bạn không có quyền sửa công thức này', { code: 'FORBIDDEN' }));
    }

    const isAdmin = req.user.role === 'admin';
    const type = requestedType(req.body);
    if (type && type !== recipe.type) {
      if (!isAdmin) return next(createError(403, 'Chỉ quản trị viên được đổi loại công thức', { code: 'FORBIDDEN' }));
      recipe.type = type;
    }

    // Whitelisted fields only (author, likesCount, type... cannot be mass-assigned)
    const fields = buildRecipeFields(req.body, { partial: true });
    if (fields.title === '') {
      return next(createError(400, 'Tên công thức là bắt buộc'));
    }
    Object.entries(fields).forEach(([key, value]) => {
      recipe.set(key, value);
    });

    const categoryInput = req.body.categoryId ?? req.body.category ?? req.body.categoryName;
    if (categoryInput !== undefined) {
      const category = await resolveCategory(categoryInput);
      if (category) recipe.category = category._id;
    }

    await recipe.save();
    const updated = await populateRecipe(Recipe.findById(recipe._id));
    res.status(200).json({
      success: true,
      message: 'Đã cập nhật công thức',
      recipe: formatRecipe(updated, req.user)
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete recipe (and the favorites pointing at it)
// @route   DELETE /api/recipes/:id
// @access  Private: owner of a personal recipe, or admin
exports.deleteRecipe = async (req, res, next) => {
  try {
    const recipe = await findRecipeOr404(req.params.id);
    if (!canEdit(recipe, req.user)) {
      if (!canView(recipe, req.user)) return next(createError(404, 'Không tìm thấy công thức'));
      return next(createError(403, 'Bạn không có quyền xóa công thức này', { code: 'FORBIDDEN' }));
    }

    await Promise.all([
      Recipe.deleteOne({ _id: recipe._id }),
      Favorite.deleteMany({ recipe: recipe._id })
    ]);

    res.status(200).json({
      success: true,
      message: 'Đã xóa công thức',
      deletedId: recipe._id.toString()
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
    const recipes = await populateRecipe(Recipe.find({ author: req.user._id })).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: recipes.length,
      recipes: recipes.map(r => formatRecipe(r, req.user))
    });
  } catch (error) {
    next(error);
  }
};
