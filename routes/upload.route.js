const express = require('express');
const router = express.Router();
const uploadController = require('../controllers/upload.controller');
const uploadMiddleware = require('../middlewares/upload.middleware');
const verifyToken = require('../middlewares/verifyToken');

router.post('/image', verifyToken, uploadMiddleware.single('image'), uploadController.uploadImage);

module.exports = router;
