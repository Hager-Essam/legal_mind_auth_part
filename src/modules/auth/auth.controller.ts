import { Request, Response, NextFunction } from 'express';
import authService from './auth.service';
import ResponseHelper from '../../shared/helpers/response.helper';

class AuthController {
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.file) {
        ResponseHelper.badRequest(res, 'Lawyer ID document is required');
        return;
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

      ResponseHelper.created(res, 'User registered successfully', {
        user: result.user,
        accessToken: result.accessToken,
      });
    } catch (error) {
      next(error);
    }
  }

  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password } = req.body;
      const ipAddress = req.ip;

      const result = await authService.login(email, password, ipAddress);

      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      ResponseHelper.ok(res, 'Login successful', {
        user: result.user,
        accessToken: result.accessToken,
      });
    } catch (error) {
      next(error);
    }
  }

  async refreshToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const token = req.body.refreshToken || req.cookies.refreshToken;
      const ipAddress = req.ip;

      if (!token) {
        ResponseHelper.badRequest(res, 'Refresh token is required');
        return;
      }

      const result = await authService.refreshToken(token, ipAddress);

      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      ResponseHelper.ok(res, 'Token refreshed successfully', {
        user: result.user,
        accessToken: result.accessToken,
      });
    } catch (error) {
      next(error);
    }
  }

  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const token = req.body.refreshToken || req.cookies.refreshToken;
      const ipAddress = req.ip;

      if (token) {
        await authService.logout(token, ipAddress);
      }

      res.clearCookie('refreshToken');

      ResponseHelper.ok(res, 'Logout successful');
    } catch (error) {
      next(error);
    }
  }

  async logoutAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).user.id;
      const ipAddress = req.ip;

      await authService.logoutAll(userId, ipAddress);

      res.clearCookie('refreshToken');

      ResponseHelper.ok(res, 'Logged out from all devices');
    } catch (error) {
      next(error);
    }
  }

  async getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      ResponseHelper.ok(res, 'User retrieved successfully', {
        user: (req as any).user,
      });
    } catch (error) {
      next(error);
    }
  }

  async forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userEmail = (req as any).user.email;
      const result = await authService.forgotPassword(userEmail);
      ResponseHelper.ok(res, result.message);
    } catch (error) {
      next(error);
    }
  }

  async resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { token, password } = req.body;
      const result = await authService.resetPassword(token, password);

      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      ResponseHelper.ok(res, result.message, {
        user: result.user,
        accessToken: result.accessToken,
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new AuthController();
