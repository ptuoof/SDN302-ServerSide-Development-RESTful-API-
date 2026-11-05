const mongoose = require('mongoose');
const createError = require('http-errors');
const { MealEntry, Recipe } = require('../models');
const { formatMealEntry, formatShoppingItem } = require('../utils/serializers');
const { canView } = require('../utils/recipeAccess');
const { scaleAmount } = require('../utils/quantity');
const { normalizeCalories } = require('../utils/recipeInput');
const { mergeIntoShoppingList } = require('../services/shopping.service');
const L = require('../config/limits');

const SLOT_ORDER = L.MEAL_SLOTS;
const pad = n => String(n).padStart(2, '0');
// Server-local "today". The app should send its own `today` (phone's calendar day) when it matters.
const serverToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const clampServings = value => Math.min(L.MEAL_SERVINGS_MAX, Math.max(1, Math.round(Number(value)) || 1));

const sortEntries = entries => entries.sort((a, b) =>
  (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)
  || SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot)
  || new Date(a.createdAt) - new Date(b.createdAt));

const findEntryOr404 = async (userId, id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) throw createError(404, 'Không tìm thấy món trong kế hoạch');
  const entry = await MealEntry.findOne({ _id: id, user: userId });
  if (!entry) throw createError(404, 'Không tìm thấy món trong kế hoạch');
  return entry;
};

const visibleRecipe = async (user, recipeId) => {
  if (!recipeId) return null;
  const recipe = await Recipe.findById(recipeId).select('title servings calories author isPublic type ingredients');
  if (!recipe || !canView(recipe, user)) throw createError(404, 'Không tìm thấy công thức');
  return recipe;
};

/** Keeps the newest MEAL_PLAN_LIMIT entries (by date), like the app. */
const enforceLimit = async userId => {
  const overflow = await MealEntry.find({ user: userId }).sort({ date: -1, createdAt: -1 }).skip(L.MEAL_PLAN_LIMIT).select('_id');
  if (overflow.length) await MealEntry.deleteMany({ _id: { $in: overflow.map(e => e._id) } });
};

// @desc    Journal / plan entries between two days (inclusive)
// @route   GET /api/meal-plans?from=YYYY-MM-DD&to=YYYY-MM-DD
// @access  Private
exports.getEntries = async (req, res, next) => {
  try {
    const filter = { user: req.user._id };
    const { from, to } = req.query;
    if (from || to) filter.date = { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) };
    const entries = sortEntries(await MealEntry.find(filter));
    res.status(200).json({ success: true, count: entries.length, entries: entries.map(formatMealEntry) });
  } catch (error) {
    next(error);
  }
};

// @desc    Log (past day) or plan (future day) a dish. A recipe gives the title; a free meal needs a title.
// @route   POST /api/meal-plans
// @access  Private
// @body    { date, slot?, recipeId? | title, calories?, servings?, eaten?, note?, today? }
//          eaten defaults to (date < today); send `today` = the phone's calendar day.
exports.createEntry = async (req, res, next) => {
  try {
    const { date, slot, recipeId, title, calories, servings, eaten, note } = req.body;
    const recipe = await visibleRecipe(req.user, recipeId);
    const cleanTitle = String(recipe?.title ?? title ?? '').trim();
    if (!cleanTitle) return next(createError(400, 'Nhập tên món hoặc chọn một công thức.'));
    const today = req.body.today || serverToday();

    const entry = await MealEntry.create({
      user: req.user._id,
      date,
      slot: SLOT_ORDER.includes(slot) ? slot : 'lunch',
      recipe: recipe?._id || null,
      title: cleanTitle.slice(0, L.MEAL_TITLE_MAX),
      // Recipe dishes follow the live recipe's kcal (null here) unless a value is given
      calories: normalizeCalories(calories),
      servings: clampServings(servings || recipe?.servings || 1),
      eaten: typeof eaten === 'boolean' ? eaten : date < today,
      note: String(note ?? '').trim().slice(0, L.MEAL_NOTE_MAX)
    });
    await enforceLimit(req.user._id);
    res.status(201).json({ success: true, entry: formatMealEntry(entry) });
  } catch (error) {
    next(error);
  }
};

// @desc    Edit an entry (partial) - also used to tick "đã ăn"
// @route   PATCH /api/meal-plans/:id
// @access  Private
// @body    { date?, slot?, recipeId?, title?, calories?, servings?, eaten?, note? }
exports.updateEntry = async (req, res, next) => {
  try {
    const entry = await findEntryOr404(req.user._id, req.params.id);
    const { date, slot, recipeId, title, calories, servings, eaten, note } = req.body;

    if (recipeId !== undefined) {
      const recipe = await visibleRecipe(req.user, recipeId);
      entry.recipe = recipe?._id || null;
      if (recipe && title === undefined) entry.title = recipe.title.slice(0, L.MEAL_TITLE_MAX);
    }
    if (date !== undefined) entry.date = date;
    if (slot !== undefined) entry.slot = slot;
    if (title !== undefined) {
      const clean = String(title ?? '').trim();
      if (!clean) return next(createError(400, 'Tên món không được để trống.'));
      entry.title = clean.slice(0, L.MEAL_TITLE_MAX);
    }
    if (calories !== undefined) entry.calories = normalizeCalories(calories);
    if (servings !== undefined) entry.servings = clampServings(servings);
    if (typeof eaten === 'boolean') entry.eaten = eaten;
    if (note !== undefined) entry.note = String(note ?? '').trim().slice(0, L.MEAL_NOTE_MAX);

    await entry.save();
    res.status(200).json({ success: true, entry: formatMealEntry(entry) });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete an entry. The deleted entry is returned (the app can re-create it to undo).
// @route   DELETE /api/meal-plans/:id
// @access  Private
exports.deleteEntry = async (req, res, next) => {
  try {
    const entry = await findEntryOr404(req.user._id, req.params.id);
    await entry.deleteOne();
    res.status(200).json({ success: true, message: 'Đã xóa khỏi kế hoạch', deletedId: req.params.id, entry: formatMealEntry(entry) });
  } catch (error) {
    next(error);
  }
};

// @desc    Copy every entry of one day onto another (as a plan, or as eaten for a past day)
// @route   POST /api/meal-plans/copy-day
// @access  Private
// @body    { fromDate, toDate, today? }
exports.copyDay = async (req, res, next) => {
  try {
    const { fromDate, toDate } = req.body;
    const today = req.body.today || serverToday();
    const source = sortEntries(await MealEntry.find({ user: req.user._id, date: fromDate }));
    const copies = await MealEntry.insertMany(source.map(entry => ({
      user: req.user._id,
      date: toDate,
      slot: entry.slot,
      recipe: entry.recipe,
      title: entry.title,
      calories: entry.calories,
      servings: entry.servings,
      eaten: toDate < today,
      note: entry.note
    })));
    await enforceLimit(req.user._id);
    res.status(201).json({ success: true, copied: copies.length, entries: copies.map(formatMealEntry) });
  } catch (error) {
    next(error);
  }
};

// @desc    Put the ingredients of planned (not eaten) recipe dishes between two days into the shopping
//          list, scaled to each entry's portions and merged with existing rows.
// @route   POST /api/meal-plans/to-shopping
// @access  Private
// @body    { from, to }
exports.addPlanToShopping = async (req, res, next) => {
  try {
    const { from, to } = req.body;
    const entries = await MealEntry.find({ user: req.user._id, eaten: false, recipe: { $ne: null }, date: { $gte: from, $lte: to } })
      .populate('recipe', 'title servings ingredients author isPublic type');
    const usable = sortEntries(entries.filter(entry => entry.recipe && canView(entry.recipe, req.user)));

    const items = usable.flatMap(entry => {
      const ratio = entry.servings / Math.max(1, entry.recipe.servings);
      return entry.recipe.ingredients.map(item => ({ name: item.name, amount: scaleAmount(item.amount, ratio), unit: item.unit }));
    });
    if (!items.length) {
      return res.status(200).json({ success: true, added: 0, merged: 0, dishes: 0, items: [] });
    }

    const result = await mergeIntoShoppingList(req.user._id, items, 'Kế hoạch bữa ăn');
    res.status(201).json({
      success: true,
      added: result.added,
      merged: result.merged,
      dishes: usable.length,
      items: result.items.map(formatShoppingItem)
    });
  } catch (error) {
    next(error);
  }
};
