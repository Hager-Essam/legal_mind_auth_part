class ResponseHelper {
  static success(res, statusCode, message, data = null) {
    return res.status(statusCode).json({
      success: true,
      message,
      data,
    });
  }

  static error(res, statusCode, message, errors = null) {
    return res.status(statusCode).json({
      success: false,
      message,
      errors,
    });
  }

  static created(res, message, data = null) {
    return this.success(res, 201, message, data);
  }

  static ok(res, message, data = null) {
    return this.success(res, 200, message, data);
  }

  static badRequest(res, message, errors = null) {
    return this.error(res, 400, message, errors);
  }

  static unauthorized(res, message = 'Unauthorized') {
    return this.error(res, 401, message);
  }

  static forbidden(res, message = 'Forbidden') {
    return this.error(res, 403, message);
  }

  static notFound(res, message = 'Resource not found') {
    return this.error(res, 404, message);
  }

  static conflict(res, message) {
    return this.error(res, 409, message);
  }

  static unprocessableEntity(res, message, errors = null) {
    return this.error(res, 422, message, errors);
  }

  static internalError(res, message = 'Internal server error') {
    return this.error(res, 500, message);
  }
}

module.exports = ResponseHelper;
