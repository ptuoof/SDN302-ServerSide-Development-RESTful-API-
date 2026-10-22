const createError = require('http-errors');

const authorizeRole = (...allowedRoles) => {
  return (req, res, next) => {
    const role = req.user?.role || req.role;

    if (!role) {
      return next(createError.Forbidden('Access denied: User role undefined'));
    }

    if (!allowedRoles.includes(role)) {
      return next(
        createError.Forbidden(
          `Access denied: Requires role [${allowedRoles.join(', ')}], but current role is [${role}]`
        )
      );
    }

    next();
  };
};

module.exports = authorizeRole;
