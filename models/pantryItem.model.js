const mongoose = require('mongoose');

const pantryItemSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    ingredientName: {
      type: String,
      required: [true, 'Ingredient name is required'],
      trim: true
    }
  },
  {
    timestamps: true
  }
);

pantryItemSchema.index({ user: 1, ingredientName: 1 }, { unique: true });

module.exports = mongoose.model('PantryItem', pantryItemSchema);
