const mongoose = require('mongoose');
const { HISTORY_NOTE_MAX } = require('../config/limits');

// One entry per dish finished in Cooking Mode (mirrors src/utils/history.js in the app).
const cookHistorySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    // The recipe may be deleted later: the title is kept so the entry stays readable
    recipe: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Recipe',
      required: [true, 'Công thức là bắt buộc']
    },
    recipeTitle: { type: String, default: '' },
    servings: { type: Number, default: 1, min: 1 },
    startedAt: { type: Date, default: null },
    finishedAt: { type: Date, required: true, default: Date.now },
    rating: { type: Number, default: null, min: 1, max: 5 },
    note: { type: String, default: '', maxlength: HISTORY_NOTE_MAX }
  },
  { timestamps: true }
);

cookHistorySchema.index({ user: 1, finishedAt: -1 });

module.exports = mongoose.model('CookHistory', cookHistorySchema);
