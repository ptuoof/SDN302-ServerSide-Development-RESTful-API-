// A user's personal data as a whole: reset, delete with the account, export / import backups.
// The backup format is the app's own (src/utils/backup.js), so a file exported by the app before
// the server existed can be imported here, and vice versa.
const mongoose = require('mongoose');
const { Recipe, Favorite, ShoppingItem, PantryItem, CookHistory, MealEntry, RecipeRequest, User } = require('../models');
const { formatRecipe, formatShoppingItem, formatHistory, formatMealEntry, formatSettings } = require('../utils/serializers');
const { buildRecipeFields } = require('../utils/recipeInput');
const { resolveCategory } = require('./category.service');
const { visibilityFilter } = require('../utils/recipeAccess');
const { normalizeUnit } = require('../utils/units');
const L = require('../config/limits');

const BACKUP_FORMAT = 'cookflow-backup';
const BACKUP_VERSION = 1;
const SETTINGS_BOOLEANS = ['keepAwake', 'timerSound', 'vibration', 'timerNotifications', 'assumeStaples', 'autoStockPantry', 'hideAllergenRecipes'];

const clampGoal = value => Math.min(L.CALORIE_GOAL_MAX, Math.max(L.CALORIE_GOAL_MIN, Math.round(Number(value)) || L.DEFAULT_CALORIE_GOAL));

/** Applies a settings patch (unknown keys ignored, goal clamped like the app). */
const applySettings = (user, patch = {}) => {
  const settings = user.settings || {};
  SETTINGS_BOOLEANS.forEach(key => {
    if (typeof patch[key] === 'boolean') settings[key] = patch[key];
  });
  if (Array.isArray(patch.allergies)) settings.allergies = [...new Set(patch.allergies.filter(id => L.ALLERGEN_IDS.includes(id)))];
  if (patch.calorieGoal != null) settings.calorieGoal = clampGoal(patch.calorieGoal);
  user.settings = settings;
};

const personalRecipeIds = async userId => (await Recipe.find({ author: userId, type: 'personal' }).select('_id')).map(r => r._id);

/** Deletes everything personal. keepAccount=false also removes requests (account deletion). */
const deletePersonalData = async (userId, { keepAccount = true } = {}) => {
  const recipeIds = await personalRecipeIds(userId);
  await Promise.all([
    Recipe.deleteMany({ _id: { $in: recipeIds } }),
    Favorite.deleteMany({ $or: [{ user: userId }, { recipe: { $in: recipeIds } }] }),
    ShoppingItem.deleteMany({ user: userId }),
    PantryItem.deleteMany({ user: userId }),
    CookHistory.deleteMany({ user: userId }),
    MealEntry.deleteMany({ user: userId }),
    ...(keepAccount ? [] : [RecipeRequest.deleteMany({ user: userId })])
  ]);
};

/** "Xóa toàn bộ dữ liệu": personal recipes, lists, history, plan and settings (onboarding stays seen). */
const resetPersonalData = async user => {
  await deletePersonalData(user._id);
  const doc = await User.findById(user._id);
  doc.settings = {};
  await doc.save();
};

const exportBackup = async user => {
  const doc = await User.findById(user._id);
  const [recipes, favorites, shopping, pantry, history, meals] = await Promise.all([
    Recipe.find({ author: user._id, type: 'personal' }).populate('category', 'name slug icon').sort({ createdAt: -1 }),
    Favorite.find({ user: user._id }).sort({ createdAt: 1 }),
    ShoppingItem.find({ user: user._id }).sort({ createdAt: -1 }),
    PantryItem.find({ user: user._id }).sort({ createdAt: 1 }),
    CookHistory.find({ user: user._id }).sort({ finishedAt: -1 }),
    MealEntry.find({ user: user._id }).sort({ date: 1, createdAt: 1 })
  ]);
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      recipes: recipes.map(r => formatRecipe(r, doc)),
      favoriteIds: favorites.map(f => f.recipe.toString()),
      shoppingList: shopping.map(formatShoppingItem),
      pantry: pantry.map(p => p.ingredientName),
      settings: formatSettings(doc),
      history: history.map(formatHistory),
      mealPlan: meals.map(formatMealEntry)
    }
  };
};

/**
 * Replaces the user's personal data with a backup ({ format, version, data } or just `data`).
 * Recipes get new ids; favorites, history and meal plan entries are re-pointed to them.
 * References to recipes that do not exist / are not visible on this server are dropped.
 */
const importBackup = async (user, payload) => {
  const backup = payload?.data && payload.format ? payload : { format: BACKUP_FORMAT, version: BACKUP_VERSION, data: payload?.data || payload };
  if (backup.format !== BACKUP_FORMAT || !backup.data || typeof backup.data !== 'object') {
    const err = new Error('Tệp không phải bản sao lưu CookFlow.');
    err.status = 400;
    throw err;
  }
  if (!(backup.version >= 1 && backup.version <= BACKUP_VERSION)) {
    const err = new Error('Bản sao lưu được tạo từ phiên bản CookFlow mới hơn.');
    err.status = 400;
    throw err;
  }
  const data = backup.data;
  await resetPersonalData(user);

  // 1. Recipes -> old id => new id
  const idMap = new Map();
  for (const raw of (Array.isArray(data.recipes) ? data.recipes : []).slice(0, 500)) {
    const fields = buildRecipeFields(raw || {});
    if (!fields.title) continue;
    const category = await resolveCategory(raw.categoryId || raw.category);
    if (!category) continue;
    const created = await Recipe.create({
      ...fields,
      category: category._id,
      author: user._id,
      type: 'personal',
      isPublic: raw.isPublic === true
    });
    if (raw.id != null) idMap.set(String(raw.id), created._id);
  }

  // Ids that are not in the file may point at catalog recipes still on the server
  const visible = visibilityFilter(user);
  const resolveRecipe = async id => {
    if (id == null) return null;
    const key = String(id);
    if (idMap.has(key)) return idMap.get(key);
    // Built-in recipes of the offline app ("rec_01") are matched through legacyId
    const where = mongoose.Types.ObjectId.isValid(key) ? { _id: key } : { legacyId: key };
    const found = await Recipe.findOne({ $and: [where, visible] }).select('_id');
    return found ? found._id : null;
  };

  // 2. Favorites
  const favIds = new Set();
  for (const id of Array.isArray(data.favoriteIds) ? data.favoriteIds : []) {
    const recipeId = await resolveRecipe(id);
    if (recipeId) favIds.add(recipeId.toString());
  }
  if (favIds.size) await Favorite.insertMany([...favIds].map(recipe => ({ user: user._id, recipe })), { ordered: false });

  // 3. Shopping list
  const shopping = (Array.isArray(data.shoppingList) ? data.shoppingList : [])
    .filter(item => item && typeof item.name === 'string' && item.name.trim())
    .slice(0, 1000)
    .reverse() // file is newest first; insert oldest first
    .map(item => ({
      user: user._id,
      name: item.name.trim(),
      amount: String(item.amount ?? '').trim() || L.DEFAULT_AMOUNT,
      unit: normalizeUnit(item.unit),
      recipeTitle: String(item.recipeTitle ?? '') || 'Mua tự do',
      checked: !!item.checked,
      stockedToPantry: !!item.stockedToPantry
    }));
  for (const item of shopping) await ShoppingItem.create(item);

  // 4. Pantry
  const pantryService = require('./pantry.service');
  await pantryService.addNames(user._id, Array.isArray(data.pantry) ? data.pantry : []);

  // 5. Settings
  const doc = await User.findById(user._id);
  applySettings(doc, data.settings || {});
  await doc.save();

  // 6. Cooking history
  let historyCount = 0;
  for (const entry of (Array.isArray(data.history) ? data.history : []).slice(0, L.HISTORY_LIMIT)) {
    const recipeId = await resolveRecipe(entry?.recipeId);
    const finishedAt = Number(entry?.finishedAt);
    if (!recipeId || !Number.isFinite(finishedAt)) continue;
    const rating = Math.round(Number(entry.rating));
    await CookHistory.create({
      user: user._id,
      recipe: recipeId,
      recipeTitle: String(entry.recipeTitle ?? ''),
      servings: Math.max(1, Math.round(Number(entry.servings) || 1)),
      startedAt: Number(entry.startedAt) > 0 ? new Date(Number(entry.startedAt)) : null,
      finishedAt: new Date(finishedAt),
      rating: rating >= 1 && rating <= 5 ? rating : null,
      note: String(entry.note ?? '').slice(0, L.HISTORY_NOTE_MAX)
    });
    historyCount += 1;
  }

  // 7. Meal plan
  let mealCount = 0;
  for (const entry of (Array.isArray(data.mealPlan) ? data.mealPlan : []).slice(-L.MEAL_PLAN_LIMIT)) {
    if (!entry || !/^\d{4}-\d{2}-\d{2}$/.test(entry.date) || !String(entry.title ?? '').trim()) continue;
    const calories = Math.round(Number(entry.calories));
    await MealEntry.create({
      user: user._id,
      date: entry.date,
      slot: L.MEAL_SLOTS.includes(entry.slot) ? entry.slot : 'lunch',
      recipe: await resolveRecipe(entry.recipeId),
      title: String(entry.title).trim().slice(0, L.MEAL_TITLE_MAX),
      calories: calories > 0 ? Math.min(L.KCAL_MAX, calories) : null,
      servings: Math.min(L.MEAL_SERVINGS_MAX, Math.max(1, Math.round(Number(entry.servings) || 1))),
      eaten: !!entry.eaten,
      note: String(entry.note ?? '').slice(0, L.MEAL_NOTE_MAX)
    });
    mealCount += 1;
  }

  return {
    recipes: idMap.size,
    favorites: favIds.size,
    shopping: shopping.length,
    history: historyCount,
    meals: mealCount
  };
};

module.exports = { applySettings, deletePersonalData, resetPersonalData, exportBackup, importBackup };
