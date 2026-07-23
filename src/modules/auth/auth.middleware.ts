import { Request, Response, NextFunction } from 'express';
import authService from './auth.service';
import userRepository from '../user/user.repository';
import ResponseHelper from '../../shared/helpers/response.helper';

const authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      ResponseHelper.unauthorized(res, 'No token provided');
      return;
    }

    const token = authHeader.split(' ')[1];

    const decoded = authService.verifyAccessToken(token);

    const user = await userRepository.findById(decoded.id);
    if (!user) {
      ResponseHelper.unauthorized(res, 'User not found');
      return;
    }

    if (!user.isActive) {
      ResponseHelper.forbidden(res, 'Account is deactivated');
      return;
    }

    (req as any).user = user;
    next();
  } catch (error) {
    next(error);
  }
};

const authorize = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!(req as any).user) {
      ResponseHelper.unauthorized(res, 'Authentication required');
      return;
    }

    if (!roles.includes((req as any).user.role)) {
      ResponseHelper.forbidden(res, 'Insufficient permissions');
      return;
    }

    next();
  };
};

const optionalAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      (req as any).user = null;
      return next();
    }

    const token = authHeader.split(' ')[1];

    const decoded = authService.verifyAccessToken(token);

    const user = await userRepository.findById(decoded.id);
    if (!user || !user.isActive) {
      (req as any).user = null;
      return next();
    }

    (req as any).user = user;
    next();
  } catch (error) {
    (req as any).user = null;
    next();
  }
};

export { authenticate, authorize, optionalAuth };
