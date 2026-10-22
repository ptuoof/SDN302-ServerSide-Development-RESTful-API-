const createError = require('http-errors');

const authorizeRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return next(createError.Forbidden('Access denied: User role undefined'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        createError.Forbidden(
          `Access denied: Requires role [${allowedRoles.join(', ')}], but current role is [${req.user.role}]`
        )
      );
    }

    next();
  };
};

module.exports = authorizeRole;
