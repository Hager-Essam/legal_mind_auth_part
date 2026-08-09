import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../../shared/http/http-error";
import type { DashboardService } from "./dashboard.service";
import { activityQuerySchema } from "./dashboard.schemas";

const MAX_RANGE_DAYS = 90;
const DEFAULT_RANGE_DAYS = 7;

const authenticated = (request: Request) => {
  if (!request.user)
    throw new HttpError(401, "يجب عليك تسجيل الدخول.", undefined, "AUTH_REQUIRED");
  return request.user;
};

export const createDashboardController = (dashboard: DashboardService) => ({
  activity: async (request: Request, response: Response, next: NextFunction) => {
    try {
      const user = authenticated(request);
      const input = activityQuerySchema.parse(request.query);

      const now = new Date();
      const defaultEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      const defaultStart = new Date(defaultEnd);
      defaultStart.setDate(defaultStart.getDate() - DEFAULT_RANGE_DAYS + 1);
      defaultStart.setHours(0, 0, 0, 0);

      const end = input.endDate ? new Date(input.endDate + "T23:59:59.999Z") : defaultEnd;
      const start = input.startDate ? new Date(input.startDate + "T00:00:00.000Z") : defaultStart;

      if (start > end) {
        throw new HttpError(
          400,
          "تاريخ البداية يجب أن يكون قبل تاريخ النهاية.",
          undefined,
          "INVALID_DATE_RANGE"
        );
      }

      const diffMs = end.getTime() - start.getTime();
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24)) + 1;
      if (diffDays > MAX_RANGE_DAYS) {
        throw new HttpError(
          400,
          `الحد الأقصى لنطاق التاريخ هو ${MAX_RANGE_DAYS} يوماً.`,
          undefined,
          "DATE_RANGE_EXCEEDED"
        );
      }

      const result = await dashboard.getDailyActivity(user.id, start, end, input.page, input.limit);
      response.json(result);
    } catch (error) {
      next(error);
    }
  },
});
