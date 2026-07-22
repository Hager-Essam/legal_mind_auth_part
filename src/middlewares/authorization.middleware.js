const AppError = require('../shared/errors/app.error');
const HTTP_STATUS = require('../shared/constants/http-status');

const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    return next();
  }

  throw new AppError(
    'Access denied. Admin privileges required.',
    HTTP_STATUS.FORBIDDEN
  );
};

const isLawyer = (req, res, next) => {
  if (req.user && (req.user.role === 'lawyer' || req.user.role === 'admin')) {
    return next();
  }

  throw new AppError(
    'Access denied. Lawyer account required.',
    HTTP_STATUS.FORBIDDEN
  );
};

const isVerifiedLawyer = (req, res, next) => {
  if (
    req.user &&
    (req.user.role === 'lawyer' || req.user.role === 'admin') &&
    req.user.isEmailVerified
  ) {
    return next();
  }

  throw new AppError(
    'Access denied. Verified lawyer account required.',
    HTTP_STATUS.FORBIDDEN
  );
};

module.exports = {
  isAdmin,
  isLawyer,
  isVerifiedLawyer,
};
