import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import { Error as MongooseError } from "mongoose";
import { ZodError } from "zod";
import { failure, type Failure } from "../core/result";
import { env } from "../config/env";
import { HttpError } from "../errors/http-error";
import { RequestValidationError } from "../errors/request-validation.error";

type ApiError = {
  status: number;
  code: string;
  message: string;
  details?: unknown;
  log: boolean;
};

const isMongoDuplicateKeyError = (
  error: unknown,
): error is { code: number } =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  error.code === 11000;

export const toErrorResult = (
  error: unknown,
): Failure<ApiError> => {
  if (error instanceof SyntaxError && "body" in error) {
    return failure({
      status: 400,
      code: "INVALID_JSON",
      message: "The JSON request body is malformed.",
      log: false,
    });
  }

  if (error instanceof ZodError) {
    const validationError = new RequestValidationError(error);
    return failure({
      status: validationError.statusCode,
      code: validationError.code,
      message: validationError.message,
      details: validationError.details,
      log: false,
    });
  }

  if (error instanceof multer.MulterError) {
    const message =
      error.code === "LIMIT_FILE_SIZE"
        ? `The lawyer ID document exceeds the configured size limit.`
        : error.code === "LIMIT_UNEXPECTED_FILE"
          ? "The lawyer ID must be one PDF, JPG, JPEG, or PNG file with a safe filename."
          : "The uploaded lawyer ID document is invalid.";
    return failure({
      status: 400,
      code: "UPLOAD_VALIDATION_ERROR",
      message,
      details: {
        field: error.field ?? "lawyerIdDocument",
        uploadCode: error.code,
      },
      log: false,
    });
  }

  if (error instanceof HttpError) {
    return failure({
      status: error.statusCode,
      code: error.code,
      message: error.message,
      details: error.details,
      log: false,
    });
  }

  if (isMongoDuplicateKeyError(error)) {
    return failure({
      status: 409,
      code: "RESOURCE_ALREADY_EXISTS",
      message: "A record with the supplied unique value already exists.",
      log: false,
    });
  }

  if (error instanceof MongooseError.ValidationError) {
    const fields = Object.fromEntries(
      Object.entries(error.errors).map(([field, fieldError]) => [
        field,
        [fieldError.message],
      ]),
    );
    return failure({
      status: 400,
      code: "DATABASE_VALIDATION_ERROR",
      message: "One or more values could not be stored.",
      details: { fields },
      log: false,
    });
  }

  if (error instanceof MongooseError.CastError) {
    return failure({
      status: 400,
      code: "INVALID_IDENTIFIER",
      message: `The value supplied for ${error.path} is invalid.`,
      log: false,
    });
  }

  return failure({
    status: 500,
    code: "INTERNAL_SERVER_ERROR",
    message: "An unexpected server error occurred.",
    log: true,
  });
};

export const notFoundHandler = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  next(
    new HttpError(
      404,
      `Route not found: ${req.method} ${req.originalUrl}`,
      undefined,
      "ROUTE_NOT_FOUND",
    ),
  );
};

export const errorHandler = (
  error: unknown,
  request: Request,
  response: Response,
  _next: NextFunction,
): void => {
  const result = toErrorResult(error);
  const apiError = result.error;

  if (apiError.log) {
    console.error(
      `[ErrorHandler] request=${request.requestId} code=${apiError.code}`,
      error,
    );
    if (
      error instanceof Error &&
      error.stack &&
      env.nodeEnv !== "production"
    ) {
      console.error(error.stack);
    }
  }

  response.status(apiError.status).json({
    success: false,
    error: apiError.code,
    message: apiError.message,
    ...(apiError.details === undefined
      ? {}
      : { details: apiError.details }),
    request_id: request.requestId,
  });
};
