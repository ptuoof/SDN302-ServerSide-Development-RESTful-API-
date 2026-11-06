const mongoose = require('mongoose');
const { MEAL_SLOTS, MEAL_TITLE_MAX, MEAL_NOTE_MAX, MEAL_SERVINGS_MAX, KCAL_MAX } = require('../config/limits');

// Meal journal + plan (mirrors src/utils/mealPlan.js in the app): one entry per dish eaten (past)
// or planned (future) on a local calendar day ('YYYY-MM-DD') and meal slot.
const mealEntrySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    date: {
      type: String,
      required: [true, 'Ngày là bắt buộc'],
      match: [/^\d{4}-\d{2}-\d{2}$/, 'Ngày phải có dạng YYYY-MM-DD']
    },
    slot: { type: String, enum: MEAL_SLOTS, default: 'lunch' },
    // null for a free meal ("Phở ngoài hàng")
    recipe: { type: mongoose.Schema.Types.ObjectId, ref: 'Recipe', default: null },
    title: {
      type: String,
      required: [true, 'Tên món là bắt buộc'],
      trim: true,
      maxlength: [MEAL_TITLE_MAX, `Tên món tối đa ${MEAL_TITLE_MAX} ký tự`]
    },
    // kcal per portion; null = follow the live recipe's kcal
    calories: { type: Number, default: null, min: 0, max: KCAL_MAX },
    // portions cooked (used when adding the plan to the shopping list)
    servings: { type: Number, default: 1, min: 1, max: MEAL_SERVINGS_MAX },
    eaten: { type: Boolean, default: false },
    note: { type: String, default: '', maxlength: [MEAL_NOTE_MAX, `Ghi chú tối đa ${MEAL_NOTE_MAX} ký tự`] }
  },
  { timestamps: true }
);

mealEntrySchema.index({ user: 1, date: 1 });

module.exports = mongoose.model('MealEntry', mealEntrySchema);
