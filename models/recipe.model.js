const mongoose = require('mongoose');
const {
  SERVINGS_MIN, SERVINGS_MAX, MINUTES_MAX, TIMER_SECONDS_MAX, KCAL_MAX, MACRO_MAX,
  DIFFICULTIES, DEFAULT_DIFFICULTY, DEFAULT_AMOUNT, DEFAULT_RECIPE_IMAGE, DIET_TAGS, RECIPE_TYPES
} = require('../config/limits');
const { normalizeVi } = require('../utils/text');

// Every ingredient / step keeps a stable `_id` (exposed to the app as `id`): the app's checklist,
// AI substitutions and step timers key on these ids, so an edit must never re-label them.
const subOptions = { _id: true, toJSON: { virtuals: true }, toObject: { virtuals: true } };

const ingredientSubSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Tên nguyên liệu là bắt buộc'],
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
    group: {
      type: String,
      default: 'Nguyên liệu chính'
    }
  },
  subOptions
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
    image: {
      type: String,
      default: ''
    },
    videoUrl: {
      type: String,
      default: ''
    },
    timerSeconds: {
      type: Number,
      default: null,
      min: [1, 'Hẹn giờ phải lớn hơn 0 giây'],
      max: [TIMER_SECONDS_MAX, `Hẹn giờ tối đa ${TIMER_SECONDS_MAX / 60} phút`]
    },
    tip: {
      type: String,
      default: ''
    }
  },
  subOptions
);

// Macros per serving, in grams. null = unknown (the app never shows a made-up 0).
const macroField = { type: Number, default: null, min: 0, max: MACRO_MAX };

const recipeSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Tên công thức là bắt buộc'],
      trim: true,
      index: true
    },
    description: {
      type: String,
      trim: true,
      default: ''
    },
    imageUrl: {
      type: String,
      default: DEFAULT_RECIPE_IMAGE
    },
    videoUrl: {
      type: String,
      default: ''
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Danh mục là bắt buộc']
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Tác giả là bắt buộc']
    },
    // Who the recipe belongs to:
    //  - system:   built-in sample recipes shipped with CookFlow (seed)
    //  - admin:    catalog recipes added by an admin from the admin screen
    //  - personal: recipes a user created / copied / imported for themselves
    type: {
      type: String,
      enum: RECIPE_TYPES,
      default: 'personal',
      index: true
    },
    // system/admin recipes are public unless an admin hides them; personal recipes are private by default
    isPublic: {
      type: Boolean,
      default: function () {
        return this.type !== 'personal';
      }
    },
    // Kept for compatibility with the app (true for personal recipes); derived from `type`.
    isCustom: {
      type: Boolean,
      default: false
    },
    prepTimeMinutes: {
      type: Number,
      default: 0,
      min: [0, 'Thời gian sơ chế không được âm'],
      max: [MINUTES_MAX, `Thời gian sơ chế tối đa ${MINUTES_MAX} phút`]
    },
    cookTimeMinutes: {
      type: Number,
      default: 0,
      min: [0, 'Thời gian nấu không được âm'],
      max: [MINUTES_MAX, `Thời gian nấu tối đa ${MINUTES_MAX} phút`]
    },
    servings: {
      type: Number,
      default: 2,
      min: [SERVINGS_MIN, `Khẩu phần tối thiểu ${SERVINGS_MIN}`],
      max: [SERVINGS_MAX, `Khẩu phần tối đa ${SERVINGS_MAX}`]
    },
    // kcal per serving; null = unknown
    calories: {
      type: Number,
      default: null,
      min: [0, 'Calories không được âm'],
      max: [KCAL_MAX, `Calories tối đa ${KCAL_MAX} kcal/phần`]
    },
    nutrition: {
      protein: macroField,
      carbs: macroField,
      fat: macroField
    },
    difficulty: {
      type: String,
      enum: DIFFICULTIES,
      default: DEFAULT_DIFFICULTY
    },
    tags: {
      type: [{ type: String, enum: DIET_TAGS }],
      default: []
    },
    colorAccent: {
      type: String,
      default: '#FF6B6B'
    },
    // Id the built-in recipe had in the offline app ("rec_01"...), so old local data / backups
    // that point at built-in recipes can be matched to the server copy
    legacyId: { type: String, default: null, index: true },
    // Provenance of personal copies (ids of the original recipe, as sent by the app)
    copiedFrom: { type: String, default: null },
    variantOf: { type: String, default: null },
    // Human-readable AI ingredient substitutions applied to a personal variant
    aiChanges: { type: [String], default: [] },
    ingredients: [ingredientSubSchema],
    steps: [stepSubSchema],
    likesCount: {
      type: Number,
      default: 0
    },
    // Accent-free text used by the search filter ("ca rot" finds "Cà rốt"). Internal field.
    searchText: {
      type: String,
      default: '',
      select: false
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

recipeSchema.pre('validate', function (next) {
  this.isCustom = this.type === 'personal';
  (this.steps || []).forEach((step, idx) => {
    step.stepNumber = idx + 1;
    if (!step.title) step.title = `Bước ${idx + 1}`;
    if (!step.instruction) step.instruction = step.title;
  });
  this.searchText = normalizeVi([
    this.title,
    this.description,
    ...(this.tags || []),
    ...(this.ingredients || []).map(i => i.name)
  ].join(' '));
  next();
});

// Text Index for full-text searching
recipeSchema.index({
  title: 'text',
  description: 'text',
  'ingredients.name': 'text'
});

module.exports = mongoose.model('Recipe', recipeSchema);
