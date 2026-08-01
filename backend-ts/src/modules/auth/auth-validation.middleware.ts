import type { NextFunction, Request, Response } from "express";
import type { ZodType } from "zod";
import { failure, success, type Result } from "../../shared/result";
import { RequestValidationError } from "../../shared/http/request-validation.error";
import { removeUploadedFile } from "./auth-upload.middleware";

export const validateBody = (schema: ZodType) => {
  return async (
    req: Request,
    _res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const parsed = schema.safeParse(req.body);
    const result: Result<unknown, RequestValidationError> = parsed.success
      ? success(parsed.data)
      : failure(new RequestValidationError(parsed.error));
    if (!result.ok) {
      await removeUploadedFile(req.file);
      next(result.error);
      return;
    }
    req.body = result.value;
    next();
  };
};
