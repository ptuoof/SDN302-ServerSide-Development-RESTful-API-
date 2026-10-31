const errorHandler = (err, req, res, next) => {
  let statusCode = err.status || 500;
  let message = err.message || 'Internal Server Error';

  // Handle Mongoose Bad ObjectId (CastError)
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Resource not found with invalid ID: ${err.value}`;
  }

  // Handle Mongoose Validation Error
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = Object.values(err.errors)
      .map(val => val.message)
      .join(', ');
  }

  // Handle Mongoose Duplicate Key (11000)
  if (err.code === 11000) {
    statusCode = 400;
    const field = Object.keys(err.keyValue)[0];
    message = `Duplicate value entered for ${field} field. Please choose another value.`;
  }

  // Handle Multer upload errors (file too large, too many files, wrong field name)
  if (err.name === 'MulterError') {
    statusCode = 400;
    const multerMessages = {
      LIMIT_FILE_SIZE: 'File is too large. Maximum size is 5MB',
      LIMIT_FILE_COUNT: 'Too many files uploaded',
      LIMIT_UNEXPECTED_FILE: `Unexpected file field: ${err.field}`
    };
    message = multerMessages[err.code] || err.message;
  }

  console.error(`[Error] ${statusCode} - ${message} | ${req.method} ${req.originalUrl}`);

  res.status(statusCode).json({
    success: false,
    error: {
      status: statusCode,
      message
    }
  });
};

module.exports = errorHandler;
