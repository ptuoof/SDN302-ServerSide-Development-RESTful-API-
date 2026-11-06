// Shopping list rules ported from the app (src/utils/shopping.js + RecipeContext.toggleShoppingItem).
const { ShoppingItem, User } = require('../models');
const { normalizeVi } = require('../utils/text');
const { addQuantities, normalizeUnit } = require('../utils/units');
const { DEFAULT_AMOUNT } = require('../config/limits');
const pantry = require('./pantry.service');

const sameText = (a, b) => normalizeVi(a) === normalizeVi(b);

const appendSource = (current, title) => {
  const sources = String(current || '').split(', ').filter(Boolean);
  return sources.includes(title) ? current : [...sources, title].join(', ');
};

/**
 * Adds ingredients without duplicating rows. An UNCHECKED row with the same name absorbs the new
 * quantity when the two can be added - same unit, or the same family (g + kg, ml + lít) - or when
 * both are the same text ("Vừa đủ"). Rows added in the same call can also merge with each other.
 * @returns {{ added: number, merged: number, items: ShoppingItem[] }} items = rows created or changed
 */
const mergeIntoShoppingList = async (userId, ingredients, source) => {
  // Newest first, like the app's list (new rows are put on top)
  const list = await ShoppingItem.find({ user: userId, checked: false }).sort({ createdAt: -1, _id: -1 });
  const touched = new Set();
  const result = { added: 0, merged: 0 };

  (ingredients || []).forEach(ing => {
    const name = String(ing?.name ?? '').trim();
    if (!name) return;
    const amount = String(ing.amount ?? '').trim() || DEFAULT_AMOUNT;
    const unit = normalizeUnit(ing.unit);
    let sum = null;
    const existing = list.find(item => {
      if (item.checked || !sameText(item.name, name)) return false;
      sum = addQuantities(item, { amount, unit });
      return !!sum || (sameText(item.amount, amount) && sameText(normalizeUnit(item.unit), unit));
    });
    if (existing) {
      if (sum) {
        existing.amount = sum.amount;
        existing.unit = sum.unit;
      }
      existing.recipeTitle = appendSource(existing.recipeTitle, source);
      touched.add(existing);
      result.merged += 1;
      return;
    }
    const created = new ShoppingItem({ user: userId, name, amount, unit, recipeTitle: source, checked: false });
    list.unshift(created);
    touched.add(created);
    result.added += 1;
  });

  const items = [...touched];
  // Sequential saves in insertion order: the last new row is the newest (shown on top, like the app)
  for (const item of items) {
    await item.save();
  }
  return { ...result, items };
};

/**
 * Marks a row bought / not bought. With the user's autoStockPantry setting, buying puts the item in
 * the pantry (flagged, so un-ticking by mistake takes it back out - but never an item that was
 * already in the pantry before).
 * @returns {{ item, pantryChanged: boolean }}
 */
const setChecked = async (user, item, checked) => {
  if (item.checked === checked) return { item, pantryChanged: false };
  let pantryChanged = false;
  const settings = user.settings || (await User.findById(user._id).select('settings'))?.settings || {};
  const autoStock = settings.autoStockPantry !== false;

  if (checked && autoStock) {
    const added = await pantry.addNames(user._id, [item.name]);
    if (added.length) {
      item.stockedToPantry = true;
      pantryChanged = true;
    }
  } else if (!checked && item.stockedToPantry) {
    const others = await ShoppingItem.find({ user: user._id, _id: { $ne: item._id }, checked: true }).select('name');
    const stillBought = others.some(row => sameText(row.name, item.name));
    if (!stillBought) {
      pantryChanged = (await pantry.removeNames(user._id, [item.name])) > 0;
    }
    item.stockedToPantry = false;
  }

  item.checked = checked;
  await item.save();
  return { item, pantryChanged };
};

module.exports = { mergeIntoShoppingList, setChecked };
