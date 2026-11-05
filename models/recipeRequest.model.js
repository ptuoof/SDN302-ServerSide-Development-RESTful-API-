const mongoose = require('mongoose');
const { REQUEST_TYPES, REQUEST_STATUSES, REQUEST_DETAILS_MAX } = require('../config/limits');

// User reports & recipe requests, reviewed by the admin (mirrors src/utils/recipeRequests.js).
const recipeRequestSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    // Snapshot of who sent it (still readable if the account is renamed or deleted)
    userEmail: { type: String, default: '' },
    userName: { type: String, default: '' },
    type: { type: String, enum: REQUEST_TYPES, required: true },
    title: { type: String, default: '', trim: true },
    details: { type: String, required: true, trim: true, maxlength: REQUEST_DETAILS_MAX },
    // The reported recipe (every type except new_recipe)
    recipe: { type: mongoose.Schema.Types.ObjectId, ref: 'Recipe', default: null },
    recipeTitle: { type: String, default: '' },
    status: { type: String, enum: REQUEST_STATUSES, default: 'pending', index: true },
    adminReply: { type: String, default: '', maxlength: REQUEST_DETAILS_MAX }
  },
  { timestamps: true }
);

module.exports = mongoose.model('RecipeRequest', recipeRequestSchema);
