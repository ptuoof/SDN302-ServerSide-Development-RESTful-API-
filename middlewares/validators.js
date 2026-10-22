const { body, validationResult } = require('express-validator');

// Error handling middleware for validation
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(err => ({
        field: err.path || err.param,
        message: err.msg,
        value: err.value
      }))
    });
  }
  next();
};

// 1. Auth Validation Rules
const validateRegister = [
  body('username')
    .trim()
    .notEmpty()
    .withMessage('Username is required')
    .isLength({ min: 3 })
    .withMessage('Username must be at least 3 characters'),
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Must be a valid email address'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
  body('fullName')
    .trim()
    .notEmpty()
    .withMessage('Full name is required'),
  handleValidationErrors
];

const validateLogin = [
  body('usernameOrEmail')
    .trim()
    .notEmpty()
    .withMessage('Username or Email is required'),
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  handleValidationErrors
];

// 2. Recipe Validation Rules
const validateRecipe = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Recipe title is required')
    .isLength({ min: 2 })
    .withMessage('Recipe title must be at least 2 characters'),
  body('description')
    .trim()
    .notEmpty()
    .withMessage('Recipe description is required'),
  body('imageUrl')
    .trim()
    .notEmpty()
    .withMessage('Image URL is required'),
  body('prepTimeMinutes')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Preparation time must be a positive integer'),
  body('cookTimeMinutes')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Cooking time must be a positive integer'),
  body('servings')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Servings must be at least 1'),
  body('difficulty')
    .optional()
    .isIn(['Dễ', 'Vừa', 'Khó'])
    .withMessage('Difficulty must be one of: Dễ, Vừa, Khó'),
  handleValidationErrors
];

// 3. Category Validation Rules
const validateCategory = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Category name is required'),
  body('slug')
    .trim()
    .notEmpty()
    .withMessage('Category slug is required'),
  handleValidationErrors
];

// 4. Shopping Item Validation Rules
const validateShoppingItem = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Item name is required'),
  handleValidationErrors
];

// 5. Pantry Item Validation Rules
const validatePantryItem = [
  body('ingredientName')
    .trim()
    .notEmpty()
    .withMessage('Ingredient name is required'),
  handleValidationErrors
];

module.exports = {
  validateRegister,
  validateLogin,
  validateRecipe,
  validateCategory,
  validateShoppingItem,
  validatePantryItem,
  handleValidationErrors
};
