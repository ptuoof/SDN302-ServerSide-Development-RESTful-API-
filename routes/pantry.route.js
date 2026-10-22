const express = require('express');
const router = express.Router();
const pantryController = require('../controllers/pantry.controller');
const verifyToken = require('../middlewares/verifyToken');
const { validatePantryItem } = require('../middlewares/validators');

router.use(verifyToken);

router.get('/', pantryController.getPantry);
router.post('/toggle', validatePantryItem, pantryController.togglePantryItem);
router.delete('/', pantryController.clearPantry);
router.get('/suggest-recipes', pantryController.suggestRecipes);

module.exports = router;
