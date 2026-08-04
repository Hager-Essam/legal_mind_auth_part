import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";

const safeRequestId = /^[a-zA-Z0-9._:-]{8,128}$/;

export const requestIdMiddleware = (request: Request, response: Response, next: NextFunction): void => {
  const supplied = request.header("x-request-id");
  request.requestId = supplied && safeRequestId.test(supplied) ? supplied : crypto.randomUUID();
  response.setHeader("x-request-id", request.requestId);
  next();
};
