import { Request, Response, NextFunction } from 'express';
import userService from './user.service';
import ResponseHelper from '../../shared/helpers/response.helper';

class UserController {
  async updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).user.id;
      const user = await userService.updateProfile(userId, req.body);

      ResponseHelper.ok(res, 'تم تحديث الملف الشخصي بنجاح', { user });
    } catch (error) {
      next(error);
    }
  }

  async uploadAvatar(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.file) {
        ResponseHelper.badRequest(res, 'يرجى رفع صورة الملف الشخصي');
        return;
      }

      const userId = (req as any).user.id;
      const avatarUrl = `/uploads/avatars/${req.file.filename}`;
      const user = await userService.updateProfile(userId, { avatar: avatarUrl });

      ResponseHelper.ok(res, 'تم رفع الصورة بنجاح', { user });
    } catch (error) {
      next(error);
    }
  }
}

export default new UserController();
