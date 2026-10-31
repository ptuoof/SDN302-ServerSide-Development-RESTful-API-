const fs = require('fs');
const path = require('path');
const createError = require('http-errors');

const uploadDir = path.join(__dirname, '../public/uploads');

const buildFileUrl = (req, filename) => `${req.protocol}://${req.get('host')}/uploads/${filename}`;

// @desc    Upload image
// @route   POST /api/upload/image
// @access  Private
exports.uploadImage = async (req, res, next) => {
  try {
    if (!req.file) {
      return next(createError.BadRequest('Please upload an image file'));
    }

    res.status(201).json({
      success: true,
      message: 'Image uploaded successfully',
      imageUrl: buildFileUrl(req, req.file.filename),
      fileName: req.file.filename,
      size: req.file.size
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Upload multiple images
// @route   POST /api/upload/images
// @access  Private
exports.uploadMultipleImages = async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) {
      return next(createError.BadRequest('Please upload at least one image file'));
    }

    const files = req.files.map(file => ({
      imageUrl: buildFileUrl(req, file.filename),
      fileName: file.filename,
      originalName: file.originalname,
      size: file.size
    }));

    res.status(201).json({
      success: true,
      message: `${files.length} image(s) uploaded successfully`,
      count: files.length,
      files
    });
  } catch (error) {
    next(error);
  }
};

// @desc    List uploaded files
// @route   GET /api/upload/files
// @access  Private
exports.listFiles = async (req, res, next) => {
  try {
    const entries = await fs.promises.readdir(uploadDir, { withFileTypes: true });
    const files = await Promise.all(
      entries
        .filter(entry => entry.isFile() && !entry.name.startsWith('.'))
        .map(async entry => {
          const stats = await fs.promises.stat(path.join(uploadDir, entry.name));
          return {
            fileName: entry.name,
            size: stats.size,
            uploadedAt: stats.mtime,
            url: buildFileUrl(req, entry.name),
            downloadUrl: `${req.protocol}://${req.get('host')}/api/upload/download/${encodeURIComponent(entry.name)}`
          };
        })
    );

    files.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));

    res.status(200).json({
      success: true,
      count: files.length,
      files
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Download a file
// @route   GET /api/upload/download/:filename
// @access  Private
exports.downloadFile = async (req, res, next) => {
  try {
    // path.basename strips any "../" so users cannot read files outside uploads/
    const safeName = path.basename(req.params.filename);
    const filePath = path.join(uploadDir, safeName);

    if (safeName.startsWith('.') || !fs.existsSync(filePath)) {
      return next(createError.NotFound('File not found'));
    }

    res.download(filePath, safeName, err => {
      if (err && !res.headersSent) {
        next(err);
      }
    });
  } catch (error) {
    next(error);
  }
};
