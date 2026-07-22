const authService = require('./auth.service');
const userRepository = require('../user/user.repository');
const ResponseHelper = require('../../shared/helpers/response.helper');
const AppError = require('../../shared/errors/app.error');
const HTTP_STATUS = require('../../shared/constants/http-status');

const authenticate = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return ResponseHelper.unauthorized(res, 'No token provided');
    }

    const token = authHeader.split(' ')[1];

    // Verify token
    const decoded = authService.verifyAccessToken(token);

    // Get user from database
    const user = await userRepository.findById(decoded.id);
    if (!user) {
      return ResponseHelper.unauthorized(res, 'User not found');
    }

    if (!user.isActive) {
      return ResponseHelper.forbidden(res, 'Account is deactivated');
    }

    // Attach user to request
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return ResponseHelper.unauthorized(res, 'Authentication required');
    }

    if (!roles.includes(req.user.role)) {
      return ResponseHelper.forbidden(res, 'Insufficient permissions');
    }

    next();
  };
};

// Optional authentication - allows viewing content without authentication
// but attaches user if token is provided
const optionalAuth = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // No token provided - continue without user
      req.user = null;
      return next();
    }

    const token = authHeader.split(' ')[1];

    // Verify token
    const decoded = authService.verifyAccessToken(token);

    // Get user from database
    const user = await userRepository.findById(decoded.id);
    if (!user || !user.isActive) {
      // Invalid or inactive user - continue without user
      req.user = null;
      return next();
    }

    // Attach user to request
    req.user = user;
    next();
  } catch (error) {
    // Token verification failed - continue without user
    req.user = null;
    next();
  }
};

module.exports = {
  authenticate,
  authorize,
  optionalAuth,
};
