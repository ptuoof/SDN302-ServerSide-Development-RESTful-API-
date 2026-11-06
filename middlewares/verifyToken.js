const jwt = require('jsonwebtoken');
const createError = require('http-errors');
const { User } = require('../models');
const { getJwtSecret } = require('../config/jwt');

const readBearer = req => {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  // Note: tokens are NOT accepted via query string (?token=) because URLs
  // are written to server logs and browser history, which can leak the token.
  return authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
};

/** Resolves the user of a token, or throws an http error (401 / 403). */
const resolveUser = async token => {
  let decoded;
  try {
    decoded = jwt.verify(token, getJwtSecret());
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw createError(401, 'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.', { code: 'TOKEN_EXPIRED' });
    }
    throw createError(401, 'Access token không hợp lệ', { code: 'TOKEN_INVALID' });
  }

  const user = await User.findById(decoded.id || decoded.userId).select('-password');
  if (!user) {
    throw createError(401, 'Tài khoản không còn tồn tại', { code: 'TOKEN_INVALID' });
  }
  // Locking takes effect immediately, even for tokens issued before
  if (user.locked) {
    throw createError(403, 'Tài khoản đã bị khóa. Liên hệ quản trị viên CookFlow.', { code: 'ACCOUNT_LOCKED' });
  }
  if (user.verified === false) {
    throw createError(403, 'Tài khoản chưa xác minh email.', { code: 'EMAIL_NOT_VERIFIED' });
  }
  return user;
};

const attach = (req, user) => {
  req.user = user;
  req.userId = user._id;
  req.role = user.role;
};

// Requires a valid Bearer token.
const verifyToken = async (req, res, next) => {
  try {
    const token = readBearer(req);
    if (!token) {
      return next(createError(401, 'Bạn cần đăng nhập để thực hiện thao tác này', { code: 'TOKEN_MISSING' }));
    }
    attach(req, await resolveUser(token));
    next();
  } catch (error) {
    next(error);
  }
};

// Public routes that show more to signed-in users (e.g. their own private recipes).
// No token -> anonymous. A token that is invalid/expired is ignored instead of failing the request.
const optionalAuth = async (req, res, next) => {
  try {
    const token = readBearer(req);
    if (token) {
      try {
        attach(req, await resolveUser(token));
      } catch {
        // stay anonymous
      }
    }
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = verifyToken;
module.exports.verifyToken = verifyToken;
module.exports.optionalAuth = optionalAuth;
