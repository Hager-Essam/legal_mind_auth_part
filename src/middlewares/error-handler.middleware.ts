import { Request, Response, NextFunction } from 'express';
import ResponseHelper from '../shared/helpers/response.helper';
import AppError from '../shared/errors/app.error';
import config from '../config/env';

const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', err);

  // Handle Mongoose validation errors
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors || {}).map((e: any) => ({
      field: e.path,
      message: e.message,
    }));
    return ResponseHelper.unprocessableEntity(res, 'Validation error', errors);
  }

  // Handle Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0] || 'Field';
    return ResponseHelper.conflict(res, `${field} already exists`);
  }

  // Handle Mongoose CastError
  if (err.name === 'CastError') {
    return ResponseHelper.badRequest(res, 'Invalid ID format');
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    return ResponseHelper.unauthorized(res, 'Invalid token');
  }

  if (err.name === 'TokenExpiredError') {
    return ResponseHelper.unauthorized(res, 'Token has expired');
  }

  // Handle AppError
  if (err instanceof AppError) {
    return ResponseHelper.error(res, err.statusCode, err.message, err.errors);
  }

  // Default error
  const statusCode = err.statusCode || 500;
  const message =
    config.nodeEnv === 'development' ? err.message : 'Internal server error';

  return ResponseHelper.error(res, statusCode, message);
};

export default errorHandler;
