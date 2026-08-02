import type { Request, Response, NextFunction } from "express";
import { queryRequestSchema } from "./query.schema";
import { HttpError } from "../../shared/http/http-error";
import type { QueryService } from "./query.service";

export const createQueryController = (queryService: QueryService) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    console.log("[QueryController] Received request:", JSON.stringify(req.body));

    try {
      const parsed = queryRequestSchema.safeParse(req.body);

      if (!parsed.success) {
        console.log("[QueryController] Validation failed:", parsed.error);

        throw new HttpError(400, "Invalid query request payload.", parsed.error.flatten());
      }
      const result = await queryService.runQuery(parsed.data);
      res.status(200).json(result);
    } catch (error) {
      console.error("[QueryController] ERROR:", error);
      next(error);
    }
  };
};
