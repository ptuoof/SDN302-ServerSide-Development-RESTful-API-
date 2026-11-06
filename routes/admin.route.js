const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const verifyToken = require('../middlewares/verifyToken');
const authorizeRole = require('../middlewares/authorizeRole');

router.use(verifyToken, authorizeRole('admin'));

router.get('/stats', adminController.getStats);

module.exports = router;
