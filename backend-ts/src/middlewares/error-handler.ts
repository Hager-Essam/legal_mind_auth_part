import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import multer from "multer";
import { HttpError } from "../errors/http-error";

export const notFoundHandler = (req: Request, _res: Response, next: NextFunction): void => {
  next(new HttpError(404, `Route not found: ${req.method} ${req.originalUrl}`));
};

export const errorHandler = (error: unknown, _req: Request, res: Response, _next: NextFunction): void => {
  if (error instanceof SyntaxError && "body" in error) {
    res.status(400).json({ error: "InvalidJsonError", message: "Malformed JSON request body." });
    return;
  }

  if (error instanceof ZodError) {
    res.status(400).json({ error: "ValidationError", message: "Invalid request data.", details: error.flatten() });
    return;
  }

  if (error instanceof HttpError) {
    res.status(error.statusCode).json({
      error: error.code,
      message: error.message,
      ...(error.details === undefined ? {} : { details: error.details }),
    });
    return;
  }

  if (error instanceof multer.MulterError) {
    const message =
      error.code === "LIMIT_FILE_SIZE"
        ? "The uploaded file exceeds the configured size limit."
        : "The uploaded lawyer ID document is invalid.";
    res.status(400).json({ error: "UploadValidationError", message });
    return;
  }

  console.error("[ErrorHandler] Unhandled error:", error);
  if (error instanceof Error && error.stack && process.env.LEGALMIND_NODE_ENV !== "production") {
    console.error("Stack trace:", error.stack);
  }
  res.status(500).json({
    error: "InternalServerError",
    message: "An unexpected server error occurred.",
  });
};
