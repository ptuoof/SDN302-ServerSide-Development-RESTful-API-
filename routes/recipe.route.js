const express = require('express');
const router = express.Router();
const recipeController = require('../controllers/recipe.controller');
const verifyToken = require('../middlewares/verifyToken');

router.get('/', recipeController.getAllRecipes);
router.get('/my/created', verifyToken, recipeController.getMyRecipes);
router.get('/:id', recipeController.getRecipeById);
router.post('/', verifyToken, recipeController.createRecipe);
router.put('/:id', verifyToken, recipeController.updateRecipe);
router.delete('/:id', verifyToken, recipeController.deleteRecipe);

module.exports = router;
