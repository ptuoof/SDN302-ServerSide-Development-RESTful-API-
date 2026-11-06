const express = require('express');
const router = express.Router();

const authRoute = require('./auth.route');
const userRoute = require('./user.route');
const categoryRoute = require('./category.route');
const recipeRoute = require('./recipe.route');
const favoriteRoute = require('./favorite.route');
const shoppingRoute = require('./shopping.route');
const pantryRoute = require('./pantry.route');
const historyRoute = require('./history.route');
const mealPlanRoute = require('./mealPlan.route');
const requestRoute = require('./request.route');
const adminRoute = require('./admin.route');
const uploadRoute = require('./upload.route');

router.use('/auth', authRoute);
router.use('/users', userRoute);
router.use('/categories', categoryRoute);
router.use('/recipes', recipeRoute);
router.use('/favorites', favoriteRoute);
router.use('/shopping', shoppingRoute);
router.use('/pantry', pantryRoute);
router.use('/history', historyRoute);
router.use('/meal-plans', mealPlanRoute);
router.use('/requests', requestRoute);
router.use('/admin', adminRoute);
router.use('/upload', uploadRoute);

module.exports = router;
