const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const config = require('../../config/env');
const userRepository = require('../user/user.repository');
const refreshTokenRepository = require('../refresh-token/refresh-token.repository');
const AppError = require('../../shared/errors/app.error');
const ERROR_MESSAGES = require('../../shared/constants/error-messages');
const HTTP_STATUS = require('../../shared/constants/http-status');

class AuthService {
  generateAccessToken(user) {
    return jwt.sign(
      {
        id: user._id,
        email: user.email,
        role: user.role,
      },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );
  }

  generateRefreshToken() {
    return crypto.randomBytes(40).toString('hex');
  }

  async register(userData) {
    // Check if user already exists
    const existingUser = await userRepository.findByEmailWithoutPassword(userData.email);
    if (existingUser) {
      throw new AppError(ERROR_MESSAGES.EMAIL_ALREADY_EXISTS, HTTP_STATUS.CONFLICT);
    }

    // Create user
    const user = await userRepository.create(userData);

    // Generate tokens
    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken();

    // Save refresh token
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    await refreshTokenRepository.create({
      token: refreshToken,
      user: user._id,
      expiresAt,
    });

    return {
      user,
      accessToken,
      refreshToken,
    };
  }

  async login(email, password, ipAddress) {
    // Find user with password
    const user = await userRepository.findByEmail(email);
    if (!user) {
      throw new AppError(ERROR_MESSAGES.INVALID_CREDENTIALS, HTTP_STATUS.UNAUTHORIZED);
    }

    // Check if user is active
    if (!user.isActive) {
      throw new AppError('Account is deactivated', HTTP_STATUS.FORBIDDEN);
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      throw new AppError(ERROR_MESSAGES.INVALID_CREDENTIALS, HTTP_STATUS.UNAUTHORIZED);
    }

    // Update last login
    await userRepository.updateLastLogin(user._id);

    // Generate tokens
    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken();

    // Save refresh token
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    await refreshTokenRepository.create({
      token: refreshToken,
      user: user._id,
      expiresAt,
      createdByIp: ipAddress,
    });

    // Remove password from user object
    user.password = undefined;

    return {
      user,
      accessToken,
      refreshToken,
    };
  }

  async refreshToken(token, ipAddress) {
    // Find refresh token
    const refreshToken = await refreshTokenRepository.findByToken(token);
    if (!refreshToken) {
      throw new AppError(ERROR_MESSAGES.REFRESH_TOKEN_INVALID, HTTP_STATUS.UNAUTHORIZED);
    }

    // Check if token is expired
    if (refreshToken.isExpired) {
      throw new AppError(ERROR_MESSAGES.TOKEN_EXPIRED, HTTP_STATUS.UNAUTHORIZED);
    }

    // Get user
    const user = refreshToken.user;

    // Generate new tokens
    const newAccessToken = this.generateAccessToken(user);
    const newRefreshToken = this.generateRefreshToken();

    // Save new refresh token
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await refreshTokenRepository.create({
      token: newRefreshToken,
      user: user._id,
      expiresAt,
      createdByIp: ipAddress,
    });

    // Revoke old refresh token
    await refreshTokenRepository.revokeToken(token, ipAddress);

    return {
      user,
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  async logout(token, ipAddress) {
    await refreshTokenRepository.revokeToken(token, ipAddress);
    return true;
  }

  async logoutAll(userId, ipAddress) {
    await refreshTokenRepository.revokeAllUserTokens(userId, ipAddress);
    return true;
  }

  verifyAccessToken(token) {
    try {
      return jwt.verify(token, config.jwt.secret);
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new AppError(ERROR_MESSAGES.TOKEN_EXPIRED, HTTP_STATUS.UNAUTHORIZED);
      }
      throw new AppError(ERROR_MESSAGES.INVALID_TOKEN, HTTP_STATUS.UNAUTHORIZED);
    }
  }

  async forgotPassword(email) {
    // Find user by email
    const user = await userRepository.findByEmailWithoutPassword(email);
    if (!user) {
      // Don't reveal if user exists or not for security
      return {
        message: 'If an account exists with that email, a password reset link has been sent.',
      };
    }

    // Generate reset token
    const resetToken = user.createPasswordResetToken();
    await user.save({ validateBeforeSave: false });

    // Send email
    const emailService = require('../../services/email.service');
    try {
      await emailService.sendPasswordResetEmail(
        user.email,
        resetToken,
        user.getFullName()
      );
    } catch (error) {
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      await user.save({ validateBeforeSave: false });
      throw new AppError('Error sending email. Please try again later.', HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }

    return {
      message: 'If an account exists with that email, a password reset link has been sent.',
    };
  }

  async resetPassword(token, newPassword) {
    // Hash the token to compare with stored token
    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    // Find user by token
    const user = await userRepository.findByResetToken(hashedToken);
    if (!user) {
      throw new AppError('Password reset token is invalid or has expired', HTTP_STATUS.BAD_REQUEST);
    }

    // Update password
    const updatedUser = await userRepository.updatePassword(user._id, newPassword);
    if (!updatedUser) {
      throw new AppError('Failed to update password', HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }

    // Send confirmation email
    const emailService = require('../../services/email.service');
    try {
      await emailService.sendPasswordResetConfirmation(
        updatedUser.email,
        updatedUser.getFullName()
      );
    } catch (error) {
      // Don't fail the password reset if email fails
      console.error('Failed to send confirmation email:', error);
    }

    // Generate new tokens
    const accessToken = this.generateAccessToken(updatedUser);
    const refreshToken = this.generateRefreshToken();

    // Save refresh token
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await refreshTokenRepository.create({
      token: refreshToken,
      user: updatedUser._id,
      expiresAt,
    });

    return {
      message: 'Password has been reset successfully',
      user: updatedUser,
      accessToken,
      refreshToken,
    };
  }
}

module.exports = new AuthService();
