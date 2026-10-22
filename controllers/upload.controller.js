const createError = require('http-errors');

// @desc    Upload image
// @route   POST /api/upload/image
// @access  Private
exports.uploadImage = async (req, res, next) => {
  try {
    if (!req.file) {
      return next(createError.BadRequest('Please upload an image file'));
    }

    const host = req.get('host');
    const protocol = req.protocol;
    const fileUrl = `${protocol}://${host}/uploads/${req.file.filename}`;

    res.status(201).json({
      success: true,
      message: 'Image uploaded successfully',
      imageUrl: fileUrl,
      fileName: req.file.filename,
      size: req.file.size
    });
  } catch (error) {
    next(error);
  }
};
