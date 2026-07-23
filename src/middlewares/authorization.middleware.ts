import { Request, Response, NextFunction } from 'express';
import AppError from '../shared/errors/app.error';
import HTTP_STATUS from '../shared/constants/http-status';

const isAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (req.user && req.user.role === 'admin') {
    return next();
  }

  throw new AppError(
    'Access denied. Admin privileges required.',
    HTTP_STATUS.FORBIDDEN
  );
};

const isLawyer = (req: Request, res: Response, next: NextFunction) => {
  if (req.user && (req.user.role === 'lawyer' || req.user.role === 'admin')) {
    return next();
  }

  throw new AppError(
    'Access denied. Lawyer account required.',
    HTTP_STATUS.FORBIDDEN
  );
};

const isVerifiedLawyer = (req: Request, res: Response, next: NextFunction) => {
  if (
    req.user &&
    (req.user.role === 'lawyer' || req.user.role === 'admin') &&
    req.user.isEmailVerified
  ) {
    return next();
  }

  throw new AppError(
    'Access denied. Verified lawyer account required.',
    HTTP_STATUS.FORBIDDEN
  );
};

export {
  isAdmin,
  isLawyer,
  isVerifiedLawyer,
};
