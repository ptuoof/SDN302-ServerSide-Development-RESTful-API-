const mongoose = require('mongoose');

const shoppingItemSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    name: {
      type: String,
      required: [true, 'Item name is required'],
      trim: true
    },
    amount: {
      type: String,
      default: '1'
    },
    unit: {
      type: String,
      default: 'phần'
    },
    recipeTitle: {
      type: String,
      default: 'Mua tự do'
    },
    checked: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('ShoppingItem', shoppingItemSchema);
