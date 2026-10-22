const express = require('express');
const router = express.Router();
const pantryController = require('../controllers/pantry.controller');
const verifyToken = require('../middlewares/verifyToken');

router.use(verifyToken);

router.get('/', pantryController.getPantry);
router.post('/toggle', pantryController.togglePantryItem);
router.delete('/', pantryController.clearPantry);
router.get('/suggest-recipes', pantryController.suggestRecipes);

module.exports = router;
