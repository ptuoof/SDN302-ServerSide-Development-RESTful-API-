const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/category.controller');
const verifyToken = require('../middlewares/verifyToken');
const authorizeRole = require('../middlewares/authorizeRole');
const { validateCategory, validateCategoryUpdate, validateCategoryReorder } = require('../middlewares/validators');

const adminOnly = [verifyToken, authorizeRole('admin')];

router.get('/', categoryController.getAllCategories);
router.post('/', adminOnly, validateCategory, categoryController.createCategory);
// Must be declared before /:id
router.put('/reorder', adminOnly, validateCategoryReorder, categoryController.reorderCategories);
router.put('/:id', adminOnly, validateCategoryUpdate, categoryController.updateCategory);
router.delete('/:id', adminOnly, categoryController.deleteCategory);

module.exports = router;
