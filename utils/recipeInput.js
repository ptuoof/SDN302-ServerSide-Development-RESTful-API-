// Turns a recipe body sent by the app (create form, QR import, AI variant, copy) into clean fields,
// with the same rules as normalizeRecipe() in the app (src/utils/recipeModel.js):
//  - 0 minutes stays 0, unknown kcal / macros stay null (never replaced by a made-up default)
//  - ingredient / step ids are kept when they are ids this server issued, so edits do not re-label
//    timers; app-local ids ("i1", "s2", "custom_x") are replaced by new server ids
const mongoose = require('mongoose');
const L = require('../config/limits');
const { normalizeVi } = require('./text');
const { normalizeUnit } = require('./units');

const str = (value, fallback = '') => {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value !== 'string') return fallback;
  return value.trim() || fallback;
};

const intIn = (value, fallback, min, max) => {
  if (value === '' || value == null) return fallback;
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
};

// Whole number in [0, max] or null when unknown (mirrors normalizeCalories / normalizeMacros)
const clampOrNull = (value, max) => {
  if (value === '' || value == null) return null;
  const n = Number(String(value).replace(',', '.'));
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.min(max, Math.round(n));
};
const normalizeCalories = value => clampOrNull(value, L.KCAL_MAX) || null;
const normalizeMacros = macros => ({
  protein: clampOrNull(macros?.protein, L.MACRO_MAX),
  carbs: clampOrNull(macros?.carbs, L.MACRO_MAX),
  fat: clampOrNull(macros?.fat, L.MACRO_MAX)
});

const normalizeTags = tags => {
  const keys = new Set((Array.isArray(tags) ? tags : []).map(normalizeVi));
  return L.DIET_TAGS.filter(tag => keys.has(normalizeVi(tag)));
};

// Keeps a sub-document id only when it is one of ours and not already used in this list
const keepId = (item, seen) => {
  const raw = item?._id ?? item?.id;
  const id = raw == null ? null : String(raw);
  if (!id || !mongoose.Types.ObjectId.isValid(id) || seen.has(id)) return undefined;
  seen.add(id);
  return id;
};

const buildIngredients = list => {
  const seen = new Set();
  return (Array.isArray(list) ? list : [])
    .filter(item => item && str(item.name))
    .map(item => {
      const _id = keepId(item, seen);
      return {
        ...(_id ? { _id } : {}),
        name: str(item.name),
        amount: str(item.amount, L.DEFAULT_AMOUNT),
        unit: normalizeUnit(str(item.unit)),
        group: str(item.group, 'Nguyên liệu chính')
      };
    });
};

const buildSteps = list => {
  const seen = new Set();
  return (Array.isArray(list) ? list : [])
    .filter(step => step && (str(step.instruction) || str(step.title)))
    .map((step, idx) => {
      const _id = keepId(step, seen);
      const seconds = Number(step.timerSeconds);
      const title = str(step.title, `Bước ${idx + 1}`);
      return {
        ...(_id ? { _id } : {}),
        stepNumber: idx + 1,
        title,
        instruction: str(step.instruction, title),
        image: str(step.image),
        videoUrl: str(step.videoUrl),
        timerSeconds: Number.isFinite(seconds) && seconds > 0 ? Math.min(Math.round(seconds), L.TIMER_SECONDS_MAX) : null,
        tip: str(step.tip)
      };
    });
};

const has = (body, key) => Object.prototype.hasOwnProperty.call(body, key) && body[key] !== undefined;

/**
 * @param body     request body
 * @param partial  true for updates: only fields present in the body are returned
 * @returns plain object of schema fields (category / type / author handled by the controller)
 */
const buildRecipeFields = (body, { partial = false } = {}) => {
  const out = {};
  const want = key => !partial || has(body, key);

  if (want('title')) out.title = str(body.title);
  if (want('description')) out.description = str(body.description);
  if (want('imageUrl')) out.imageUrl = str(body.imageUrl, L.DEFAULT_RECIPE_IMAGE);
  if (want('videoUrl')) out.videoUrl = str(body.videoUrl);
  if (want('prepTimeMinutes')) out.prepTimeMinutes = intIn(body.prepTimeMinutes, 0, 0, L.MINUTES_MAX);
  if (want('cookTimeMinutes')) out.cookTimeMinutes = intIn(body.cookTimeMinutes, 0, 0, L.MINUTES_MAX);
  if (want('servings')) out.servings = intIn(body.servings, 2, L.SERVINGS_MIN, L.SERVINGS_MAX);
  if (want('calories')) out.calories = normalizeCalories(body.calories);
  if (want('nutrition')) out.nutrition = normalizeMacros(body.nutrition);
  if (want('difficulty')) out.difficulty = L.DIFFICULTIES.includes(body.difficulty) ? body.difficulty : L.DEFAULT_DIFFICULTY;
  if (want('tags')) out.tags = normalizeTags(body.tags);
  if (has(body, 'colorAccent') || !partial) out.colorAccent = str(body.colorAccent, '#FF6B6B');
  if (want('copiedFrom')) out.copiedFrom = str(body.copiedFrom) || null;
  if (want('variantOf')) out.variantOf = str(body.variantOf) || null;
  if (want('aiChanges')) out.aiChanges = (Array.isArray(body.aiChanges) ? body.aiChanges : []).map(c => str(c)).filter(Boolean).slice(0, 100);
  if (want('ingredients')) out.ingredients = buildIngredients(body.ingredients);
  if (want('steps')) out.steps = buildSteps(body.steps);
  if (has(body, 'isPublic') && typeof body.isPublic === 'boolean') out.isPublic = body.isPublic;
  return out;
};

module.exports = { buildRecipeFields, normalizeCalories, normalizeMacros, normalizeTags };
