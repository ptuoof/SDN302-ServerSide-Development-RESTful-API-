const multer = require('multer');
const path = require('path');
const fs = require('fs');
const createError = require('http-errors');

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '../public/uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const makeStorage = prefix => multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${prefix}-${uniqueSuffix}${ext}`);
  }
});

const imageFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|webp|gif|heic|heif/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (extname && mimetype) {
    return cb(null, true);
  }
  cb(createError(400, 'Chỉ chấp nhận tệp ảnh (jpeg, jpg, png, webp, gif, heic)'));
};

// Videos picked from the phone album (recipe video / step video)
const VIDEO_EXT = /\.(mp4|mov|m4v|webm|3gp)$/i;
const VIDEO_MIME = /^video\/(mp4|quicktime|x-m4v|webm|3gpp)$/i;
const videoFilter = (req, file, cb) => {
  if (VIDEO_EXT.test(file.originalname) && VIDEO_MIME.test(file.mimetype)) {
    return cb(null, true);
  }
  cb(createError(400, 'Chỉ chấp nhận tệp video (mp4, mov, m4v, webm, 3gp)'));
};

const IMAGE_MAX_BYTES = 5 * 1024 * 1024; // 5MB
const VIDEO_MAX_BYTES = 50 * 1024 * 1024; // 50MB

const upload = multer({
  storage: makeStorage('img'),
  limits: { fileSize: IMAGE_MAX_BYTES },
  fileFilter: imageFilter
});

const videoUpload = multer({
  storage: makeStorage('vid'),
  limits: { fileSize: VIDEO_MAX_BYTES },
  fileFilter: videoFilter
});

module.exports = upload;
module.exports.videoUpload = videoUpload;
module.exports.IMAGE_MAX_BYTES = IMAGE_MAX_BYTES;
module.exports.VIDEO_MAX_BYTES = VIDEO_MAX_BYTES;
