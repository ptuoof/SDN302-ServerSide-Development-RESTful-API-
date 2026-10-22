const jwt = require('jsonwebtoken');
const createError = require('http-errors');
const { User } = require('../models');

const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'] || req.headers['Authorization'];
    let token = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.headers['x-access-token']) {
      token = req.headers['x-access-token'];
    } else if (req.query && req.query.token) {
      token = req.query.token;
    }

    if (!token) {
      return next(createError.Unauthorized('Access token is missing'));
    }

    const secret = process.env.JWT_SECRET || 'cookflow_sdn302_fpt_secret_key_2026';

    jwt.verify(token, secret, async (err, decoded) => {
      if (err) {
        if (err.name === 'TokenExpiredError') {
          return next(createError.Unauthorized('Access token has expired'));
        }
        return next(createError.Unauthorized('Invalid access token'));
      }

      const user = await User.findById(decoded.id || decoded.userId).select('-password');
      if (!user) {
        return next(createError.Unauthorized('User account no longer exists'));
      }

      req.user = user;
      req.userId = user._id;
      req.role = user.role;
      next();
    });
  } catch (error) {
    next(error);
  }
};

module.exports = verifyToken;
