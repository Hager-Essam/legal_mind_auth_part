const ERROR_MESSAGES = {
  // Auth
  INVALID_CREDENTIALS: 'Invalid email or password',
  EMAIL_ALREADY_EXISTS: 'Email already exists',
  UNAUTHORIZED: 'Unauthorized access',
  TOKEN_EXPIRED: 'Token has expired',
  INVALID_TOKEN: 'Invalid token',
  REFRESH_TOKEN_INVALID: 'Invalid refresh token',
  
  // User
  USER_NOT_FOUND: 'User not found',
  USER_ALREADY_EXISTS: 'User already exists',
  
  // Validation
  VALIDATION_ERROR: 'Validation error',
  REQUIRED_FIELD: 'This field is required',
  INVALID_EMAIL: 'Invalid email format',
  WEAK_PASSWORD: 'Password must be at least 8 characters with uppercase, lowercase, and numbers',
  
  // Server
  INTERNAL_SERVER_ERROR: 'Internal server error',
  DATABASE_ERROR: 'Database error occurred',
};

module.exports = ERROR_MESSAGES;
