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
    const existingUser = await userRepository.findByEmailWithoutPassword(userData.email);
    if (existingUser) {
      throw new AppError(ERROR_MESSAGES.EMAIL_ALREADY_EXISTS, HTTP_STATUS.CONFLICT);
    }

    const user = await userRepository.create(userData);

    // Generate email verification token and send verification email.
    // The user is NOT logged in automatically — they must verify their
    // email first (see login()).
    const verificationToken = user.createEmailVerificationToken();
    await user.save({ validateBeforeSave: false });

    try {
      await emailService.sendVerificationEmail(
        user.email,
        verificationToken,
        user.getFullName()
      );
    } catch (error) {
      user.emailVerificationToken = undefined;
      user.emailVerificationExpires = undefined;
      await user.save({ validateBeforeSave: false });
      throw new AppError('حدث خطأ أثناء إرسال بريد التفعيل. حاول مرة أخرى لاحقًا.', HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }

    return {
      user,
      message: 'تم التسجيل بنجاح. يرجى التحقق من بريدك الإلكتروني لتفعيل حسابك.',
    };
  }

  async login(email: string, password: string, ipAddress?: string) {
   
    const user = await userRepository.findByEmail(email);
    if (!user) {
      throw new AppError(ERROR_MESSAGES.INVALID_CREDENTIALS, HTTP_STATUS.UNAUTHORIZED);
    }

 
    if (!user.isActive) {
      throw new AppError('تم إيقاف الحساب', HTTP_STATUS.FORBIDDEN);
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      throw new AppError(ERROR_MESSAGES.INVALID_CREDENTIALS, HTTP_STATUS.UNAUTHORIZED);
    }

    // Block login until the user has verified their email
    if (!user.isEmailVerified) {
      throw new AppError(ERROR_MESSAGES.EMAIL_NOT_VERIFIED, HTTP_STATUS.FORBIDDEN);
    }

    // Update last login
    await userRepository.updateLastLogin(user._id);

    // Generate tokens
    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken();

    // Save refresh token
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); 

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

    // Always return the same generic message whether or not the email is
    // registered, so this endpoint can't be used to find out which emails
    // exist in the system.
    const genericMessage = 'إذا كان البريد الإلكتروني مسجلاً لدينا، فسيتم إرسال رابط إعادة تعيين كلمة المرور إليه.';

    if (!user) {
      return { message: genericMessage };
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
      throw new AppError('حدث خطأ أثناء إرسال البريد الإلكتروني. حاول مرة أخرى لاحقًا.', HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }

    return {
      message: genericMessage,
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
      throw new AppError('رمز إعادة تعيين كلمة المرور غير صالح أو منتهي الصلاحية', HTTP_STATUS.BAD_REQUEST);
    }

    // Update password
    const updatedUser = await userRepository.updatePassword(user._id.toString(), newPassword);
    if (!updatedUser) {
      throw new AppError('فشل تحديث كلمة المرور', HTTP_STATUS.INTERNAL_SERVER_ERROR);
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
      message: 'تمت إعادة تعيين كلمة المرور بنجاح',
      user: updatedUser,
      accessToken,
      refreshToken,
    };
  }

  async verifyEmail(token: string) {
    // Hash the token to compare with the stored hashed token
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await userRepository.findByVerificationToken(hashedToken);
    if (!user) {
      throw new AppError(ERROR_MESSAGES.VERIFICATION_TOKEN_INVALID, HTTP_STATUS.BAD_REQUEST);
    }

    if (user.isEmailVerified) {
      // Token was valid but the account was already verified (e.g. double click) —
      // invalidate the leftover token and return success idempotently.
      user.emailVerificationToken = undefined;
      user.emailVerificationExpires = undefined;
      await user.save({ validateBeforeSave: false });
      return { message: 'تم تفعيل البريد الإلكتروني بالفعل' };
    }

    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save({ validateBeforeSave: false });

    return { message: 'تم تفعيل البريد الإلكتروني بنجاح. يمكنك الآن تسجيل الدخول.' };
  }

  async resendVerification(email: string) {
    const user = await userRepository.findByEmailWithoutPassword(email);
    if (!user) {
      throw new AppError(ERROR_MESSAGES.USER_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
    }

    if (user.isEmailVerified) {
      throw new AppError(ERROR_MESSAGES.EMAIL_ALREADY_VERIFIED, HTTP_STATUS.BAD_REQUEST);
    }

    const verificationToken = user.createEmailVerificationToken();
    await user.save({ validateBeforeSave: false });

    try {
      await emailService.sendVerificationEmail(
        user.email,
        verificationToken,
        user.getFullName()
      );
    } catch (error) {
      user.emailVerificationToken = undefined;
      user.emailVerificationExpires = undefined;
      await user.save({ validateBeforeSave: false });
      throw new AppError('حدث خطأ أثناء إرسال بريد التفعيل. حاول مرة أخرى لاحقًا.', HTTP_STATUS.INTERNAL_SERVER_ERROR);
    }

    return { message: 'تم إعادة إرسال بريد التفعيل. يرجى التحقق من بريدك الوارد.' };
  }
}

export default new AuthService();
