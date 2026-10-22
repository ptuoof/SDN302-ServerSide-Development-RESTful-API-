const mongoose = require('mongoose');

const ingredientSubSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Ingredient name is required'],
      trim: true
    },
    amount: {
      type: String,
      default: ''
    },
    unit: {
      type: String,
      default: 'phần'
    },
    group: {
      type: String,
      default: 'Nguyên liệu chính'
    }
  },
  { _id: true }
);

const stepSubSchema = new mongoose.Schema(
  {
    stepNumber: {
      type: Number,
      required: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    instruction: {
      type: String,
      required: true
    },
    videoUrl: {
      type: String,
      default: ''
    },
    timerSeconds: {
      type: Number,
      default: null
    },
    tip: {
      type: String,
      default: ''
    }
  },
  { _id: true }
);

const recipeSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Recipe title is required'],
      trim: true,
      index: true
    },
    description: {
      type: String,
      required: [true, 'Recipe description is required'],
      trim: true
    },
    imageUrl: {
      type: String,
      required: [true, 'Image URL is required']
    },
    videoUrl: {
      type: String,
      default: ''
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Category is required']
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Author is required']
    },
    prepTimeMinutes: {
      type: Number,
      default: 10
    },
    cookTimeMinutes: {
      type: Number,
      default: 15
    },
    servings: {
      type: Number,
      default: 2
    },
    calories: {
      type: Number,
      default: 250
    },
    difficulty: {
      type: String,
      enum: ['Dễ', 'Vừa', 'Khó'],
      default: 'Dễ'
    },
    colorAccent: {
      type: String,
      default: '#FF6B6B'
    },
    isCustom: {
      type: Boolean,
      default: false
    },
    isPublic: {
      type: Boolean,
      default: true
    },
    ingredients: [ingredientSubSchema],
    steps: [stepSubSchema],
    likesCount: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Text Index for full-text searching
recipeSchema.index({
  title: 'text',
  description: 'text',
  'ingredients.name': 'text'
});

module.exports = mongoose.model('Recipe', recipeSchema);
