import type { NextFunction, Request, Response } from "express";
import type { ZodType } from "zod";
import { removeUploadedFile } from "./upload.middleware";

export const validateBody = (schema: ZodType) => {
  return async (
    req: Request,
    _res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      await removeUploadedFile(req.file);
      next(result.error);
      return;
    }
    req.body = result.data;
    next();
  };
};
