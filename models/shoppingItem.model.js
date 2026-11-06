const mongoose = require('mongoose');
const { DEFAULT_AMOUNT } = require('../config/limits');

const shoppingItemSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    name: {
      type: String,
      required: [true, 'Tên món cần mua là bắt buộc'],
      trim: true
    },
    amount: {
      type: String,
      default: DEFAULT_AMOUNT
    },
    unit: {
      type: String,
      default: ''
    },
    // Where the row comes from; merged rows list every source: "Phở bò, Kế hoạch bữa ăn"
    recipeTitle: {
      type: String,
      default: 'Mua tự do'
    },
    checked: {
      type: Boolean,
      default: false
    },
    // true when ticking this row put the ingredient into the pantry (autoStockPantry),
    // so un-ticking by mistake takes it back out — but never an item that was already there.
    stockedToPantry: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('ShoppingItem', shoppingItemSchema);
