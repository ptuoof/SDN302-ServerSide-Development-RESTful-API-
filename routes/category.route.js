const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/category.controller');
const verifyToken = require('../middlewares/verifyToken');
const authorizeRole = require('../middlewares/authorizeRole');
const { validateCategory } = require('../middlewares/validators');

router.get('/', categoryController.getAllCategories);
router.post('/', verifyToken, authorizeRole('admin'), validateCategory, categoryController.createCategory);
router.put('/:id', verifyToken, authorizeRole('admin'), categoryController.updateCategory);
router.delete('/:id', verifyToken, authorizeRole('admin'), categoryController.deleteCategory);

module.exports = router;
