const express = require('express');
const router = express.Router();
const uploadController = require('../controllers/upload.controller');
const uploadMiddleware = require('../middlewares/upload.middleware');
const verifyToken = require('../middlewares/verifyToken');

const MAX_FILES_PER_REQUEST = 5;

// Upload a single image (form-data field: "image")
router.post('/image', verifyToken, uploadMiddleware.single('image'), uploadController.uploadImage);

// Upload a single video (form-data field: "video", max 50MB)
router.post('/video', verifyToken, uploadMiddleware.videoUpload.single('video'), uploadController.uploadVideo);

// Upload multiple images at once (form-data field: "images", max 5 files)
router.post(
  '/images',
  verifyToken,
  uploadMiddleware.array('images', MAX_FILES_PER_REQUEST),
  uploadController.uploadMultipleImages
);

// List uploaded files
router.get('/files', verifyToken, uploadController.listFiles);

// Download a file by its name (sent as attachment)
router.get('/download/:filename', verifyToken, uploadController.downloadFile);

module.exports = router;
