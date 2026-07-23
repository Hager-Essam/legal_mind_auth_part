const authService = require('./auth.service');
const ResponseHelper = require('../../shared/helpers/response.helper');
const HTTP_STATUS = require('../../shared/constants/http-status');

class AuthController {
  async register(req, res, next) {
    try {
      if (!req.file) {
        return ResponseHelper.badRequest(res, 'Lawyer ID document is required');
      }

      const lawyerIdDocument = `/uploads/lawyer-ids/${req.file.filename}`;
      const userData = {
        ...req.body,
        lawyerIdDocument,
      };

      const result = await authService.register(userData);

      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      return ResponseHelper.created(res, 'User registered successfully', {
        user: result.user,
        accessToken: result.accessToken,
      });
    } catch (error) {
      next(error);
    }
  }

  async login(req, res, next) {
    try {
      const { email, password } = req.body;
      const ipAddress = req.ip;

      const result = await authService.login(email, password, ipAddress);

      // Set refresh token as httpOnly cookie
      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      return ResponseHelper.ok(res, 'Login successful', {
        user: result.user,
        accessToken: result.accessToken,
      });
    } catch (error) {
      next(error);
    }
  }

  async refreshToken(req, res, next) {
    try {
      const token = req.body.refreshToken || req.cookies.refreshToken;
      const ipAddress = req.ip;

      if (!token) {
        return ResponseHelper.badRequest(res, 'Refresh token is required');
      }

      const result = await authService.refreshToken(token, ipAddress);

      // Set new refresh token as httpOnly cookie
      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      return ResponseHelper.ok(res, 'Token refreshed successfully', {
        user: result.user,
        accessToken: result.accessToken,
      });
    } catch (error) {
      next(error);
    }
  }

  async logout(req, res, next) {
    try {
      const token = req.body.refreshToken || req.cookies.refreshToken;
      const ipAddress = req.ip;

      if (token) {
        await authService.logout(token, ipAddress);
      }

      // Clear refresh token cookie
      res.clearCookie('refreshToken');

      return ResponseHelper.ok(res, 'Logout successful');
    } catch (error) {
      next(error);
    }
  }

  async logoutAll(req, res, next) {
    try {
      const userId = req.user.id;
      const ipAddress = req.ip;

      await authService.logoutAll(userId, ipAddress);

      // Clear refresh token cookie
      res.clearCookie('refreshToken');

      return ResponseHelper.ok(res, 'Logged out from all devices');
    } catch (error) {
      next(error);
    }
  }

  async getMe(req, res, next) {
    try {
      return ResponseHelper.ok(res, 'User retrieved successfully', {
        user: req.user,
      });
    } catch (error) {
      next(error);
    }
  }

  async forgotPassword(req, res, next) {
    try {
      const userEmail = req.user.email;
      const result = await authService.forgotPassword(userEmail);
      return ResponseHelper.ok(res, result.message);
    } catch (error) {
      next(error);
    }
  }

  async resetPassword(req, res, next) {
    try {
      const { token, password } = req.body;
      const result = await authService.resetPassword(token, password);

      // Set refresh token as httpOnly cookie
      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      return ResponseHelper.ok(res, result.message, {
        user: result.user,
        accessToken: result.accessToken,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AuthController();
