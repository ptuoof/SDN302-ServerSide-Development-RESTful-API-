// Centralized error handler. Every error response has the same shape so the app needs one parser:
// {
//   success: false,
//   message: 'Thông báo hiển thị được cho người dùng (tiếng Việt)',
//   code: 'EMAIL_NOT_VERIFIED' | 'ACCOUNT_LOCKED' | ...   (optional, machine-readable)
//   errors: [{ field, message, value }]                     (optional, validation details)
//   error: { status, message }                              (kept for backward compatibility)
// }
const errorHandler = (err, req, res, next) => {
  let statusCode = err.status || err.statusCode || 500;
  let message = err.message || 'Lỗi máy chủ nội bộ';
  let errors = Array.isArray(err.errors) ? err.errors : undefined;

  // Mongoose Bad ObjectId (CastError)
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `ID không hợp lệ: ${err.value}`;
  }

  // Mongoose Validation Error
  if (err.name === 'ValidationError') {
    statusCode = 400;
    errors = Object.values(err.errors).map(val => ({ field: val.path, message: val.message, value: val.value }));
    message = errors.map(e => e.message).join(', ');
  }

  // Mongoose Duplicate Key (11000)
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue || {})[0] || 'dữ liệu';
    message = `Giá trị của trường "${field}" đã tồn tại. Hãy chọn giá trị khác.`;
  }

  // Multer upload errors (file too large, too many files, wrong field name)
  if (err.name === 'MulterError') {
    statusCode = 400;
    const multerMessages = {
      LIMIT_FILE_SIZE: 'Tệp quá lớn so với giới hạn cho phép',
      LIMIT_FILE_COUNT: 'Tải lên quá nhiều tệp cùng lúc',
      LIMIT_UNEXPECTED_FILE: `Trường tệp không hợp lệ: ${err.field}`
    };
    message = multerMessages[err.code] || err.message;
  }

  // Malformed JSON body
  if (err.type === 'entity.parse.failed') {
    statusCode = 400;
    message = 'Dữ liệu gửi lên không phải JSON hợp lệ';
  }

  if (statusCode >= 500 && process.env.NODE_ENV === 'production') {
    message = 'Lỗi máy chủ nội bộ';
  }

  if (process.env.NODE_ENV !== 'test' || statusCode >= 500) {
    console.error(`[Error] ${statusCode} - ${message} | ${req.method} ${req.originalUrl}`);
  }

  const body = {
    success: false,
    message,
    error: {
      status: statusCode,
      message
    }
  };
  if (typeof err.code === 'string') body.code = err.code;
  if (errors) body.errors = errors;

  res.status(statusCode).json(body);
};

module.exports = errorHandler;
