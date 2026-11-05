const mongoose = require('mongoose');
const { normalizeVi } = require('../utils/text');

const pantryItemSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    ingredientName: {
      type: String,
      required: [true, 'Tên nguyên liệu là bắt buộc'],
      trim: true
    },
    // Accent/case-insensitive key ("Hành lá" -> "hanh la"): one pantry row per ingredient, like the app
    normalizedName: {
      type: String,
      required: true
    }
  },
  {
    timestamps: true
  }
);

pantryItemSchema.pre('validate', function (next) {
  this.normalizedName = normalizeVi(this.ingredientName);
  next();
});

pantryItemSchema.index({ user: 1, normalizedName: 1 }, { unique: true });

module.exports = mongoose.model('PantryItem', pantryItemSchema);
