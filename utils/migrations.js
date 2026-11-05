// Idempotent data migrations, run at startup (and by the seed / tests) right after connecting.
// They bring databases created by earlier versions of this API up to the current schema.
const { Recipe, PantryItem } = require('../models');
const { normalizeVi } = require('./text');

const log = (...args) => {
  if (process.env.NODE_ENV !== 'test') console.log('[Migration]', ...args);
};

/** Recipes without `type` (v1): user-created ones become private personal recipes, others system recipes. */
const migrateRecipes = async () => {
  // Raw documents: the stored values, not the schema defaults Mongoose would fill in
  const outdated = await Recipe.collection
    .find({ $or: [{ type: { $exists: false } }, { searchText: { $exists: false } }, { searchText: '' }] })
    .project({ _id: 1, type: 1, isCustom: 1 })
    .toArray();
  let changed = 0;
  for (const raw of outdated) {
    const recipe = await Recipe.findById(raw._id).select('+searchText');
    if (!recipe) continue;
    if (!raw.type) {
      recipe.type = raw.isCustom ? 'personal' : 'system';
      recipe.markModified('type');
      if (raw.isCustom) {
        recipe.isPublic = false; // the app shows personal recipes to their owner only
        recipe.markModified('isPublic');
      }
    }
    recipe.markModified('searchText'); // rebuilt by pre('validate')
    try {
      await recipe.save({ validateModifiedOnly: true });
      changed += 1;
    } catch (error) {
      log(`Skip recipe ${recipe._id}: ${error.message}`);
    }
  }
  if (changed) log(`Updated ${changed} recipe(s) (type / search index)`);
};

/** Pantry rows without normalizedName (v1): fill it, drop accent-duplicates, rebuild indexes. */
const migratePantry = async () => {
  const rows = await PantryItem.collection.find({ normalizedName: { $exists: false } }).toArray();
  if (rows.length) {
    for (const row of rows) {
      const key = normalizeVi(row.ingredientName);
      const duplicate = await PantryItem.collection.findOne({ user: row.user, normalizedName: key });
      if (duplicate || !key) {
        await PantryItem.collection.deleteOne({ _id: row._id });
      } else {
        await PantryItem.collection.updateOne({ _id: row._id }, { $set: { normalizedName: key } });
      }
    }
    log(`Updated ${rows.length} pantry row(s)`);
  }
  // Replaces the old unique (user, ingredientName) index by (user, normalizedName)
  await PantryItem.syncIndexes();
};

const runMigrations = async () => {
  await migratePantry();
  await migrateRecipes();
};

module.exports = { runMigrations };
