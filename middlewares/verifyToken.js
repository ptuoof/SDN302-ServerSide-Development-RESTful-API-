const jwt = require('jsonwebtoken');
const createError = require('http-errors');
const { User } = require('../models');

const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'] || req.headers['Authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(createError.Unauthorized('Access token is missing or invalid format'));
    }

    const token = authHeader.split(' ')[1];
    const secret = process.env.JWT_SECRET || 'cookflow_sdn302_fpt_secret_key_2026';

    jwt.verify(token, secret, async (err, decoded) => {
      if (err) {
        if (err.name === 'TokenExpiredError') {
          return next(createError.Unauthorized('Access token has expired'));
        }
        return next(createError.Unauthorized('Invalid access token'));
      }

      const user = await User.findById(decoded.id).select('-password');
      if (!user) {
        return next(createError.Unauthorized('User no longer exists'));
      }

      req.user = user;
      next();
    });
  } catch (error) {
    next(error);
  }
};

module.exports = verifyToken;
