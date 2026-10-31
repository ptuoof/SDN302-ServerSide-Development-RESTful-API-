const jwt = require('jsonwebtoken');
const createError = require('http-errors');
const { User } = require('../models');
const { getJwtSecret } = require('../config/jwt');

const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'] || req.headers['Authorization'];
    let token = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }
    // Note: tokens are NOT accepted via query string (?token=) because URLs
    // are written to server logs and browser history, which can leak the token.

    if (!token) {
      return next(createError.Unauthorized('Access token is missing'));
    }

    jwt.verify(token, getJwtSecret(), async (err, decoded) => {
      if (err) {
        if (err.name === 'TokenExpiredError') {
          return next(createError.Unauthorized('Access token has expired'));
        }
        return next(createError.Unauthorized('Invalid access token'));
      }

      try {
        const user = await User.findById(decoded.id || decoded.userId).select('-password');
        if (!user) {
          return next(createError.Unauthorized('User account no longer exists'));
        }

        req.user = user;
        req.userId = user._id;
        req.role = user.role;
        next();
      } catch (dbError) {
        next(dbError);
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = verifyToken;
