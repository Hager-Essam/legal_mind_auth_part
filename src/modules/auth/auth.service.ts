import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import config from '../../config/env';
import userRepository from '../user/user.repository';
import refreshTokenRepository from '../refresh-token/refresh-token.repository';
import AppError from '../../shared/errors/app.error';
import ERROR_MESSAGES from '../../shared/constants/error-messages';
import HTTP_STATUS from '../../shared/constants/http-status';
import emailService from '../../services/email.service';

class AuthService {
  generateAccessToken(user: any) {
    return jwt.sign(
      {
        id: user._id,
        email: user.email,
        role: user.role,
      },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn } as any
    );
  }

  generateRefreshToken() {
    return crypto.randomBytes(40).toString('hex');
  }

  async register(userData: any) {
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
      user: user._id as any,
      expiresAt,
    });

    return {
      user,
      accessToken,
      refreshToken,
    };
  }

  async login(email: string, password: string, ipAddress?: string) {
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
      user: user._id as any,
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

  async refreshToken(token: string, ipAddress?: string) {
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
      user: (user as any)._id,
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

  async logout(token: string, ipAddress?: string) {
    await refreshTokenRepository.revokeToken(token, ipAddress);
    return true;
  }

  async logoutAll(userId: any, ipAddress?: string) {
    await refreshTokenRepository.revokeAllUserTokens(userId, ipAddress);
    return true;
  }

  verifyAccessToken(token: string): any {
    try {
      return jwt.verify(token, config.jwt.secret);
    } catch (error: any) {
      if (error.name === 'TokenExpiredError') {
        throw new AppError(ERROR_MESSAGES.TOKEN_EXPIRED, HTTP_STATUS.UNAUTHORIZED);
      }
      throw new AppError(ERROR_MESSAGES.INVALID_TOKEN, HTTP_STATUS.UNAUTHORIZED);
    }
  }

  async forgotPassword(email: string) {
    const user = await userRepository.findByEmailWithoutPassword(email);
    if (!user) {
      throw new AppError('User not found', HTTP_STATUS.NOT_FOUND);
    }

    const resetToken = user.createPasswordResetToken();
    await user.save({ validateBeforeSave: false });

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
      message: 'Password reset link has been sent to your email.',
    };
  }

  async resetPassword(token: string, newPassword: string) {
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
    const updatedUser = await userRepository.updatePassword(user._id.toString(), newPassword);
    if (!updatedUser) {
      throw new AppError('Failed to update password', HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }

    // Send confirmation email
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
      user: updatedUser._id as any,
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

export default new AuthService();
