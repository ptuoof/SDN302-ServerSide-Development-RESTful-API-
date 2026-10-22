const express = require('express');
const router = express.Router();
const shoppingController = require('../controllers/shopping.controller');
const verifyToken = require('../middlewares/verifyToken');

router.use(verifyToken);

router.get('/', shoppingController.getShoppingList);
router.post('/', shoppingController.addCustomItem);
router.post('/bulk', shoppingController.addBulkFromRecipe);
router.patch('/:id/toggle', shoppingController.toggleItem);
router.delete('/clear-checked', shoppingController.clearCheckedItems);
router.delete('/:id', shoppingController.deleteItem);

module.exports = router;
