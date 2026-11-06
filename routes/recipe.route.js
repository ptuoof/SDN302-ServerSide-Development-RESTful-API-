const express = require('express');
const router = express.Router();
const recipeController = require('../controllers/recipe.controller');
const { verifyToken, optionalAuth } = require('../middlewares/verifyToken');
const { validateRecipe, validateRecipeUpdate } = require('../middlewares/validators');

// Public reads: signed-in users also get their private recipes, admins get everything
router.get('/', optionalAuth, recipeController.getAllRecipes);
router.get('/my/created', verifyToken, recipeController.getMyRecipes);
router.get('/:id', optionalAuth, recipeController.getRecipeById);
router.post('/', verifyToken, validateRecipe, recipeController.createRecipe);
router.put('/:id', verifyToken, validateRecipeUpdate, recipeController.updateRecipe);
router.patch('/:id', verifyToken, validateRecipeUpdate, recipeController.updateRecipe);
router.delete('/:id', verifyToken, recipeController.deleteRecipe);

module.exports = router;
