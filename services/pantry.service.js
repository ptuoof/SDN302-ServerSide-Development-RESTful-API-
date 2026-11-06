// Pantry rules (same as the app's RecipeContext): one row per ingredient, compared without
// accents/case ("hanh la" === "Hành lá"), kept in the order they were added.
const { PantryItem } = require('../models');
const { normalizeVi } = require('../utils/text');

const cleanNames = names => (Array.isArray(names) ? names : [names])
  .map(name => (typeof name === 'string' ? name.trim().replace(/\s+/g, ' ') : ''))
  .filter(name => normalizeVi(name));

/** Ingredient names of a user, oldest first. */
const listNames = async userId => {
  const items = await PantryItem.find({ user: userId }).sort({ createdAt: 1, _id: 1 });
  return items.map(item => item.ingredientName);
};

const has = (userId, name) => PantryItem.exists({ user: userId, normalizedName: normalizeVi(name) });

/** Adds names that are not in the pantry yet. @returns the names actually added */
const addNames = async (userId, names) => {
  const added = [];
  for (const name of cleanNames(names)) {
    if (await has(userId, name)) continue;
    try {
      await PantryItem.create({ user: userId, ingredientName: name });
      added.push(name);
    } catch (error) {
      if (error.code !== 11000) throw error; // added concurrently: already there
    }
  }
  return added;
};

/** Removes every pantry row matching one of the names. @returns number removed */
const removeNames = async (userId, names) => {
  const keys = [...new Set(cleanNames(names).map(normalizeVi))];
  if (!keys.length) return 0;
  const result = await PantryItem.deleteMany({ user: userId, normalizedName: { $in: keys } });
  return result.deletedCount;
};

/** Adds the name when missing, removes it otherwise. @returns 'added' | 'removed' */
const toggleName = async (userId, name) => {
  const [clean] = cleanNames(name);
  if (!clean) return null;
  const removed = await PantryItem.findOneAndDelete({ user: userId, normalizedName: normalizeVi(clean) });
  if (removed) return 'removed';
  await addNames(userId, [clean]);
  return 'added';
};

module.exports = { listNames, addNames, removeNames, toggleName, cleanNames };
