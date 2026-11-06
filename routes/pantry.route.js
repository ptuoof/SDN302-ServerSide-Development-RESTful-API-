const express = require('express');
const router = express.Router();
const pantryController = require('../controllers/pantry.controller');
const verifyToken = require('../middlewares/verifyToken');
const { validatePantryItem, validatePantryNames } = require('../middlewares/validators');

router.use(verifyToken);

router.get('/', pantryController.getPantry);
router.post('/', validatePantryNames, pantryController.addPantryItems);
router.post('/toggle', validatePantryItem, pantryController.togglePantryItem);
router.post('/remove', validatePantryNames, pantryController.removePantryItems);
router.delete('/', pantryController.clearPantry);
router.get('/suggest-recipes', pantryController.suggestRecipes);

module.exports = router;
