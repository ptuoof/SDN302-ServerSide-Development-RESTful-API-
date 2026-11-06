const express = require('express');
const router = express.Router();
const shoppingController = require('../controllers/shopping.controller');
const verifyToken = require('../middlewares/verifyToken');
const { validateShoppingItem, validateShoppingBulk, validateShoppingPatch } = require('../middlewares/validators');

router.use(verifyToken);

router.get('/', shoppingController.getShoppingList);
router.post('/', validateShoppingItem, shoppingController.addCustomItem);
router.post('/bulk', validateShoppingBulk, shoppingController.addBulkFromRecipe);
router.post('/restore', validateShoppingItem, shoppingController.restoreItem);
// Static paths before /:id
router.delete('/clear-checked', shoppingController.clearCheckedItems);
router.patch('/:id/toggle', shoppingController.toggleItem);
router.patch('/:id', validateShoppingPatch, shoppingController.updateItem);
router.delete('/:id', shoppingController.deleteItem);

module.exports = router;
