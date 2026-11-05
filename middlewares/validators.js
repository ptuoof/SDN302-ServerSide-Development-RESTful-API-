const { body, query, validationResult } = require('express-validator');
const createError = require('http-errors');
const L = require('../config/limits');

// Validation errors go through the central error handler, so they have the same shape as every
// other error: { success:false, message:<first error>, errors:[{ field, message, value }] }.
const handleValidationErrors = (req, res, next) => {
  const result = validationResult(req);
  if (result.isEmpty()) return next();
  const errors = result.array().map(err => ({
    field: err.path || err.param,
    message: err.msg,
    value: err.value
  }));
  next(createError(400, errors[0].message, { errors, code: 'VALIDATION_ERROR' }));
};

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
const isDateKey = value => typeof value === 'string' && DATE_KEY.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));

// Reusable rules
const emailRule = (field = 'email') => body(field)
  .trim()
  .notEmpty().withMessage('Email là bắt buộc')
  .isEmail().withMessage('Email chưa đúng định dạng. Ví dụ: ban@example.com.');

const otpRule = body('code')
  .trim()
  .matches(/^\d{6}$/).withMessage('Mã xác minh gồm 6 chữ số');

const nameRule = (field, { optional = false } = {}) => {
  let rule = body(field);
  if (optional) rule = rule.optional({ values: 'undefined' });
  return rule
    .isString().withMessage('Tên hiển thị không hợp lệ')
    .trim()
    .isLength({ min: L.NAME_MIN }).withMessage(`Tên hiển thị cần ít nhất ${L.NAME_MIN} ký tự.`)
    .isLength({ max: L.NAME_MAX }).withMessage(`Tên hiển thị tối đa ${L.NAME_MAX} ký tự.`);
};

const intRange = (field, min, max, label) => body(field)
  .optional({ values: 'falsy' })
  .isInt({ min, max }).withMessage(`${label} phải là số nguyên từ ${min} đến ${max}`);

// ---------------------------------------------------------------------------
// 1. Auth
// ---------------------------------------------------------------------------
// The app sends { name, email, password }; older clients send { username, fullName, ... }.
// Password strength itself is checked in the controller (same rule as the app).
const validateRegister = [
  emailRule(),
  body('password').notEmpty().withMessage('Mật khẩu là bắt buộc'),
  body().custom(value => {
    const name = String(value?.name ?? value?.fullName ?? '').trim();
    if (!name) throw new Error('Hãy nhập họ tên.');
    if (name.length < L.NAME_MIN) throw new Error(`Tên hiển thị cần ít nhất ${L.NAME_MIN} ký tự.`);
    if (name.length > L.NAME_MAX) throw new Error(`Tên hiển thị tối đa ${L.NAME_MAX} ký tự.`);
    return true;
  }),
  body('username')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ min: 3 }).withMessage('Username cần ít nhất 3 ký tự'),
  handleValidationErrors
];

// Accepts { email, password } (app) or { usernameOrEmail, password } (Postman / older clients)
const validateLogin = [
  body().custom(value => {
    if (!String(value?.email ?? value?.usernameOrEmail ?? value?.username ?? '').trim()) {
      throw new Error('Hãy nhập email hoặc username');
    }
    return true;
  }),
  body('password').notEmpty().withMessage('Mật khẩu là bắt buộc'),
  handleValidationErrors
];

const validateVerifyEmail = [emailRule(), otpRule, handleValidationErrors];
const validateEmailOnly = [emailRule(), handleValidationErrors];
const validateResetPassword = [
  emailRule(),
  otpRule,
  body('newPassword').notEmpty().withMessage('Mật khẩu mới là bắt buộc'),
  handleValidationErrors
];
const validateChangePassword = [
  body('currentPassword').notEmpty().withMessage('Hãy nhập mật khẩu hiện tại'),
  body('newPassword').notEmpty().withMessage('Hãy nhập mật khẩu mới'),
  handleValidationErrors
];

const validateProfile = [
  body().custom(value => {
    const raw = value?.name ?? value?.fullName;
    if (raw === undefined) return true;
    const name = String(raw).trim();
    if (name.length < L.NAME_MIN) throw new Error(`Tên hiển thị cần ít nhất ${L.NAME_MIN} ký tự.`);
    if (name.length > L.NAME_MAX) throw new Error(`Tên hiển thị tối đa ${L.NAME_MAX} ký tự.`);
    return true;
  }),
  body('avatar')
    .optional({ values: 'null' })
    .isString().withMessage('Avatar phải là đường dẫn ảnh (URL)'),
  handleValidationErrors
];

// ---------------------------------------------------------------------------
// 2. Recipes
// ---------------------------------------------------------------------------
const recipeCommonRules = [
  intRange('prepTimeMinutes', 0, L.MINUTES_MAX, 'Thời gian sơ chế (phút)'),
  intRange('cookTimeMinutes', 0, L.MINUTES_MAX, 'Thời gian nấu (phút)'),
  intRange('servings', L.SERVINGS_MIN, L.SERVINGS_MAX, 'Khẩu phần'),
  body('calories')
    .optional({ values: 'falsy' })
    .isFloat({ min: 0, max: L.KCAL_MAX }).withMessage(`Calories phải từ 0 đến ${L.KCAL_MAX} kcal/phần`),
  body('difficulty')
    .optional({ values: 'falsy' })
    .isIn(L.DIFFICULTIES).withMessage(`Độ khó phải là một trong: ${L.DIFFICULTIES.join(', ')}`),
  body('type')
    .optional({ values: 'falsy' })
    .isIn(L.RECIPE_TYPES).withMessage(`Loại công thức phải là một trong: ${L.RECIPE_TYPES.join(', ')}`),
  body('isPublic').optional({ values: 'null' }).isBoolean().withMessage('isPublic phải là true/false'),
  body('tags').optional({ values: 'null' }).isArray().withMessage('Tags phải là mảng'),
  body('nutrition').optional({ values: 'null' }).isObject().withMessage('Nutrition phải là object { protein, carbs, fat }'),
  body('ingredients').optional({ values: 'null' }).isArray().withMessage('Nguyên liệu phải là mảng'),
  body('steps').optional({ values: 'null' }).isArray().withMessage('Các bước nấu phải là mảng'),
  body('steps.*.timerSeconds')
    .optional({ values: 'falsy' })
    .isInt({ min: 1, max: L.TIMER_SECONDS_MAX }).withMessage(`Hẹn giờ mỗi bước tối đa ${L.TIMER_SECONDS_MAX / 60} phút`)
];

const validateRecipe = [
  body('title')
    .isString().withMessage('Tên công thức là bắt buộc')
    .trim()
    .notEmpty().withMessage('Tên công thức là bắt buộc')
    .isLength({ min: 2 }).withMessage('Tên công thức cần ít nhất 2 ký tự'),
  ...recipeCommonRules,
  handleValidationErrors
];

// All fields optional, but must be valid when sent
const validateRecipeUpdate = [
  body('title')
    .optional()
    .isString().withMessage('Tên công thức không hợp lệ')
    .trim()
    .isLength({ min: 2 }).withMessage('Tên công thức cần ít nhất 2 ký tự'),
  ...recipeCommonRules,
  handleValidationErrors
];

// ---------------------------------------------------------------------------
// 3. Categories (name rules - length, reserved, duplicates - are checked in the controller)
// ---------------------------------------------------------------------------
const validateCategory = [
  body('name').isString().withMessage('Tên danh mục không được để trống.').trim().notEmpty().withMessage('Tên danh mục không được để trống.'),
  body('order').optional().isInt({ min: 0 }).withMessage('Thứ tự phải là số nguyên không âm'),
  handleValidationErrors
];

const validateCategoryUpdate = [
  body('name').optional().isString().trim().notEmpty().withMessage('Tên danh mục không được để trống.'),
  body('slug').optional().isString().trim().notEmpty().withMessage('Slug không được để trống'),
  body('order').optional().isInt({ min: 0 }).withMessage('Thứ tự phải là số nguyên không âm'),
  handleValidationErrors
];

const validateCategoryReorder = [
  body().custom(value => {
    const list = value?.ids ?? value?.names;
    if (!Array.isArray(list) || list.length === 0) throw new Error('Gửi danh sách "ids" (hoặc "names") theo thứ tự mới');
    return true;
  }),
  handleValidationErrors
];

// ---------------------------------------------------------------------------
// 4. Shopping list
// ---------------------------------------------------------------------------
const validateShoppingItem = [
  body('name').isString().withMessage('Tên món cần mua là bắt buộc').trim().notEmpty().withMessage('Tên món cần mua là bắt buộc'),
  handleValidationErrors
];

const validateShoppingBulk = [
  body('ingredients').isArray({ min: 1 }).withMessage('Danh sách nguyên liệu (ingredients) là bắt buộc'),
  handleValidationErrors
];

const validateShoppingPatch = [
  body('name').optional().isString().trim().notEmpty().withMessage('Tên món cần mua không được để trống'),
  body('amount').optional({ values: 'null' }).isString().withMessage('Số lượng phải là chuỗi'),
  body('unit').optional({ values: 'null' }).isString().withMessage('Đơn vị phải là chuỗi'),
  body('checked').optional().isBoolean().withMessage('checked phải là true/false'),
  handleValidationErrors
];

// ---------------------------------------------------------------------------
// 5. Pantry
// ---------------------------------------------------------------------------
const validatePantryItem = [
  body('ingredientName').isString().withMessage('Tên nguyên liệu là bắt buộc').trim().notEmpty().withMessage('Tên nguyên liệu là bắt buộc'),
  handleValidationErrors
];

// { ingredientName } or { names: [...] }
const validatePantryNames = [
  body().custom(value => {
    const names = Array.isArray(value?.names) ? value.names : [value?.ingredientName];
    if (!names.some(name => typeof name === 'string' && name.trim())) throw new Error('Gửi "ingredientName" hoặc mảng "names"');
    return true;
  }),
  handleValidationErrors
];

// ---------------------------------------------------------------------------
// 6. Cooking history
// ---------------------------------------------------------------------------
const validateHistory = [
  body('recipeId').isMongoId().withMessage('recipeId không hợp lệ'),
  body('servings').optional({ values: 'falsy' }).isInt({ min: 1, max: L.SERVINGS_MAX }).withMessage(`Khẩu phần từ 1 đến ${L.SERVINGS_MAX}`),
  body('rating').optional({ values: 'null' }).isInt({ min: 1, max: 5 }).withMessage('Đánh giá từ 1 đến 5 sao'),
  body('note').optional({ values: 'null' }).isString().isLength({ max: L.HISTORY_NOTE_MAX }).withMessage(`Ghi chú tối đa ${L.HISTORY_NOTE_MAX} ký tự`),
  body('startedAt').optional({ values: 'null' }).isNumeric().withMessage('startedAt là thời điểm (epoch ms)'),
  body('finishedAt').optional({ values: 'null' }).isNumeric().withMessage('finishedAt là thời điểm (epoch ms)'),
  handleValidationErrors
];

// ---------------------------------------------------------------------------
// 7. Meal plan
// ---------------------------------------------------------------------------
const dateBody = (field, { optional = false } = {}) => {
  let rule = body(field);
  if (optional) rule = rule.optional();
  return rule.custom(isDateKey).withMessage(`${field} phải có dạng YYYY-MM-DD`);
};

const mealCommonRules = [
  body('slot').optional().isIn(L.MEAL_SLOTS).withMessage(`Bữa ăn phải là một trong: ${L.MEAL_SLOTS.join(', ')}`),
  body('recipeId').optional({ values: 'null' }).isMongoId().withMessage('recipeId không hợp lệ'),
  body('title').optional({ values: 'null' }).isString().isLength({ max: L.MEAL_TITLE_MAX }).withMessage(`Tên món tối đa ${L.MEAL_TITLE_MAX} ký tự`),
  body('calories').optional({ values: 'falsy' }).isFloat({ min: 0, max: L.KCAL_MAX }).withMessage(`Calories từ 0 đến ${L.KCAL_MAX}`),
  body('servings').optional({ values: 'falsy' }).isInt({ min: 1, max: L.MEAL_SERVINGS_MAX }).withMessage(`Số phần từ 1 đến ${L.MEAL_SERVINGS_MAX}`),
  body('eaten').optional({ values: 'null' }).isBoolean().withMessage('eaten phải là true/false'),
  body('note').optional({ values: 'null' }).isString().isLength({ max: L.MEAL_NOTE_MAX }).withMessage(`Ghi chú tối đa ${L.MEAL_NOTE_MAX} ký tự`),
  dateBody('today', { optional: true })
];

const validateMealCreate = [dateBody('date'), ...mealCommonRules, handleValidationErrors];
const validateMealUpdate = [dateBody('date', { optional: true }), ...mealCommonRules, handleValidationErrors];
const validateMealCopyDay = [dateBody('fromDate'), dateBody('toDate'), dateBody('today', { optional: true }), handleValidationErrors];
const validateMealRange = [dateBody('from'), dateBody('to'), handleValidationErrors];
const validateMealQuery = [
  query('from').optional().custom(isDateKey).withMessage('from phải có dạng YYYY-MM-DD'),
  query('to').optional().custom(isDateKey).withMessage('to phải có dạng YYYY-MM-DD'),
  handleValidationErrors
];

// ---------------------------------------------------------------------------
// 8. Recipe requests / reports (business rules in the controller, like buildRequest() in the app)
// ---------------------------------------------------------------------------
const validateRequestCreate = [
  body('type').isIn(L.REQUEST_TYPES).withMessage('Chọn loại yêu cầu.'),
  body('recipeId').optional({ values: 'null' }).isMongoId().withMessage('recipeId không hợp lệ'),
  body('title').optional({ values: 'null' }).isString(),
  body('details').isString().withMessage('Hãy nhập mô tả chi tiết.'),
  handleValidationErrors
];

const validateRequestUpdate = [
  body('status').optional().isIn(L.REQUEST_STATUSES).withMessage(`Trạng thái phải là một trong: ${L.REQUEST_STATUSES.join(', ')}`),
  body('adminReply').optional({ values: 'null' }).isString().isLength({ max: L.REQUEST_DETAILS_MAX }).withMessage(`Phản hồi tối đa ${L.REQUEST_DETAILS_MAX} ký tự`),
  handleValidationErrors
];

// ---------------------------------------------------------------------------
// 9. Admin - users
// ---------------------------------------------------------------------------
const adminUserCommon = [
  body('role').optional().isIn(['user', 'admin']).withMessage('Quyền phải là user hoặc admin'),
  body('verified').optional().isBoolean().withMessage('verified phải là true/false'),
  body('locked').optional().isBoolean().withMessage('locked phải là true/false'),
  body('password')
    .optional({ values: 'falsy' })
    .isLength({ min: L.PASSWORD_MIN }).withMessage(`Mật khẩu cần ít nhất ${L.PASSWORD_MIN} ký tự.`)
];

const validateAdminUserCreate = [
  emailRule(),
  body().custom(value => {
    const name = String(value?.name ?? value?.fullName ?? '').trim();
    if (name.length < L.NAME_MIN) throw new Error(`Tên cần ít nhất ${L.NAME_MIN} ký tự.`);
    if (name.length > L.NAME_MAX) throw new Error(`Tên tối đa ${L.NAME_MAX} ký tự.`);
    return true;
  }),
  body('password').notEmpty().withMessage(`Mật khẩu ban đầu cần ít nhất ${L.PASSWORD_MIN} ký tự.`),
  ...adminUserCommon,
  handleValidationErrors
];

const validateAdminUserUpdate = [
  body('email').optional().trim().isEmail().withMessage('Email không hợp lệ.'),
  body().custom(value => {
    const raw = value?.name ?? value?.fullName;
    if (raw === undefined) return true;
    const name = String(raw).trim();
    if (name.length < L.NAME_MIN) throw new Error(`Tên cần ít nhất ${L.NAME_MIN} ký tự.`);
    if (name.length > L.NAME_MAX) throw new Error(`Tên tối đa ${L.NAME_MAX} ký tự.`);
    return true;
  }),
  ...adminUserCommon,
  handleValidationErrors
];

// ---------------------------------------------------------------------------
// 10. Settings
// ---------------------------------------------------------------------------
const validateSettings = [
  body('allergies').optional().isArray().withMessage('allergies phải là mảng'),
  body('calorieGoal').optional({ values: 'null' }).isNumeric().withMessage('calorieGoal phải là số'),
  body('hasSeenOnboarding').optional().isBoolean().withMessage('hasSeenOnboarding phải là true/false'),
  handleValidationErrors
];

module.exports = {
  isDateKey,
  validateRegister,
  validateLogin,
  validateVerifyEmail,
  validateEmailOnly,
  validateResetPassword,
  validateChangePassword,
  validateProfile,
  validateRecipe,
  validateRecipeUpdate,
  validateCategory,
  validateCategoryUpdate,
  validateCategoryReorder,
  validateShoppingItem,
  validateShoppingBulk,
  validateShoppingPatch,
  validatePantryItem,
  validatePantryNames,
  validateHistory,
  validateMealCreate,
  validateMealUpdate,
  validateMealCopyDay,
  validateMealRange,
  validateMealQuery,
  validateRequestCreate,
  validateRequestUpdate,
  validateAdminUserCreate,
  validateAdminUserUpdate,
  validateSettings,
  handleValidationErrors
};
