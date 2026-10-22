const express = require('express');
const router = express.Router();

const authRoute = require('./auth.route');
const categoryRoute = require('./category.route');
const recipeRoute = require('./recipe.route');
const favoriteRoute = require('./favorite.route');
const shoppingRoute = require('./shopping.route');
const pantryRoute = require('./pantry.route');
const uploadRoute = require('./upload.route');

router.use('/auth', authRoute);
router.use('/categories', categoryRoute);
router.use('/recipes', recipeRoute);
router.use('/favorites', favoriteRoute);
router.use('/shopping', shoppingRoute);
router.use('/pantry', pantryRoute);
router.use('/upload', uploadRoute);

module.exports = router;
