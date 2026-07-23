import { Response } from 'express';

class ResponseHelper {
  static success(res: Response, statusCode: number, message: string, data: any = null) {
    return res.status(statusCode).json({
      success: true,
      message,
      data,
    });
  }

  static error(res: Response, statusCode: number, message: string, errors: any = null) {
    return res.status(statusCode).json({
      success: false,
      message,
      errors,
    });
  }

  static created(res: Response, message: string, data: any = null) {
    return this.success(res, 201, message, data);
  }

  static ok(res: Response, message: string, data: any = null) {
    return this.success(res, 200, message, data);
  }

  static badRequest(res: Response, message: string, errors: any = null) {
    return this.error(res, 400, message, errors);
  }

  static unauthorized(res: Response, message = 'Unauthorized') {
    return this.error(res, 401, message);
  }

  static forbidden(res: Response, message = 'Forbidden') {
    return this.error(res, 403, message);
  }

  static notFound(res: Response, message = 'Resource not found') {
    return this.error(res, 404, message);
  }

  static conflict(res: Response, message: string) {
    return this.error(res, 409, message);
  }

  static unprocessableEntity(res: Response, message: string, errors: any = null) {
    return this.error(res, 422, message, errors);
  }

  static internalError(res: Response, message = 'Internal server error') {
    return this.error(res, 500, message);
  }
}

export default ResponseHelper;
