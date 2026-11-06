// Business limits shared with the mobile app (src/constants/limits.js, src/utils/*.js).
// Keep these in sync with the FE so a value accepted on one side is never rejected on the other.
module.exports = {
  // Recipes
  SERVINGS_MIN: 1,
  SERVINGS_MAX: 50,
  MINUTES_MAX: 1440, // prep / cook time per recipe
  TIMER_SECONDS_MAX: 600 * 60, // one step timer
  KCAL_MAX: 5000, // per serving
  MACRO_MAX: 500, // grams per serving
  DIFFICULTIES: ['Dễ', 'Vừa', 'Khó'],
  DEFAULT_DIFFICULTY: 'Vừa',
  DEFAULT_AMOUNT: 'Vừa đủ',
  DEFAULT_RECIPE_IMAGE: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80',
  DIET_TAGS: ['Chay', 'Eat clean', 'Ít đường', 'Giàu đạm', 'Không cay', 'Cho trẻ em'],
  RECIPE_TYPES: ['system', 'admin', 'personal'],

  // Categories
  ALL_CATEGORY: 'Tất cả',
  PREFERRED_DEFAULT_CATEGORY: 'Món chính 🍲',
  CATEGORY_NAME_MAX: 30,

  // Accounts
  NAME_MIN: 2,
  NAME_MAX: 40,
  PASSWORD_MIN: 8,
  OTP_TTL_MINUTES: 10,
  OTP_MAX_ATTEMPTS: 5,

  // Settings
  ALLERGEN_IDS: ['seafood', 'peanut', 'nuts', 'dairy', 'egg', 'gluten', 'soy', 'sesame'],
  DEFAULT_CALORIE_GOAL: 2000,
  CALORIE_GOAL_MIN: 800,
  CALORIE_GOAL_MAX: 6000,

  // Cooking history
  HISTORY_LIMIT: 200,
  HISTORY_NOTE_MAX: 200,

  // Meal plan
  MEAL_SLOTS: ['breakfast', 'lunch', 'dinner', 'snack'],
  MEAL_PLAN_LIMIT: 1000,
  MEAL_TITLE_MAX: 80,
  MEAL_NOTE_MAX: 120,
  MEAL_SERVINGS_MAX: 50,

  // Recipe requests / reports
  REQUEST_TYPES: ['new_recipe', 'wrong_info', 'improve', 'inappropriate'],
  REQUEST_STATUSES: ['pending', 'in_progress', 'resolved', 'rejected'],
  REQUEST_TITLE_MAX: 80,
  REQUEST_DETAILS_MIN: 10,
  REQUEST_DETAILS_MAX: 600,
  OPEN_REQUESTS_PER_USER: 10
};
