const createError = require('http-errors');

const authorizeRole = (...allowedRoles) => {
  return (req, res, next) => {
    const role = req.user?.role || req.role;

    if (!role) {
      return next(createError(403, 'Không xác định được quyền của tài khoản', { code: 'FORBIDDEN' }));
    }

    if (!allowedRoles.includes(role)) {
      return next(
        createError(403, `Bạn không có quyền thực hiện thao tác này (cần quyền: ${allowedRoles.join(', ')})`, {
          code: 'FORBIDDEN'
        })
      );
    }

    next();
  };
};

module.exports = authorizeRole;
