import { Request, Response, NextFunction } from 'express';
import authService from './auth.service';
import ResponseHelper from '../../shared/helpers/response.helper';

class AuthController {
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.file) {
        ResponseHelper.badRequest(res, 'مستند هوية المحامي مطلوب');
        return;
      }

      const lawyerIdDocument = `/uploads/lawyer-ids/${req.file.filename}`;
      const userData = {
        ...req.body,
        lawyerIdDocument,
      };

      const result = await authService.register(userData);

      ResponseHelper.created(res, result.message, {
        user: result.user,
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

      ResponseHelper.ok(res, 'تم تسجيل الدخول بنجاح', {
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
        ResponseHelper.badRequest(res, 'رمز التحديث مطلوب');
        return;
      }

      const result = await authService.refreshToken(token, ipAddress);

      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      ResponseHelper.ok(res, 'تم تحديث الرمز بنجاح', {
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

      ResponseHelper.ok(res, 'تم تسجيل الخروج بنجاح');
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

      ResponseHelper.ok(res, 'تم تسجيل الخروج من جميع الأجهزة');
    } catch (error) {
      next(error);
    }
  }

  async getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      ResponseHelper.ok(res, 'تم استرجاع بيانات المستخدم بنجاح', {
        user: (req as any).user,
      });
    } catch (error) {
      next(error);
    }
  }

  async forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email } = req.body;
      const result = await authService.forgotPassword(email);
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

  async verifyEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { token } = req.body;
      const result = await authService.verifyEmail(token);
      ResponseHelper.ok(res, result.message);
    } catch (error) {
      next(error);
    }
  }

  async resendVerification(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email } = req.body;
      const result = await authService.resendVerification(email);
      ResponseHelper.ok(res, result.message);
    } catch (error) {
      next(error);
    }
  }
}

export default new AuthController();
