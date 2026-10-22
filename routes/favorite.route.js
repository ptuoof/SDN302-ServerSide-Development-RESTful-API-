const express = require('express');
const router = express.Router();
const favoriteController = require('../controllers/favorite.controller');
const verifyToken = require('../middlewares/verifyToken');

router.use(verifyToken);

router.get('/', favoriteController.getFavorites);
router.post('/:recipeId/toggle', favoriteController.toggleFavorite);

module.exports = router;
