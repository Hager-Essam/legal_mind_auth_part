import type { Request, Response } from "express";

import { env } from "../config/env";
import type { AppServices } from "../services/service-container";

export const createHealthController = (services: AppServices) => {
  return {
    health: async (_req: Request, res: Response) => {
      const mongo = await services.mongoService.health();
      const status = mongo.pingOk ? "ok" : "degraded";
      res.status(mongo.pingOk ? 200 : 503).json({
        status,
        service: env.appName,
        environment: env.nodeEnv,
      });
    },

    readiness: async (_req: Request, res: Response) => {
      const mongo = await services.mongoService.health();
      const provider = services.providerConfigService.getSummary();
      const ok = mongo.pingOk && provider.llmConfigured;
      res.status(ok ? 200 : 503).json({
        status: ok ? "ok" : "degraded",
        checks: {
          mongo: mongo.pingOk,
          provider: provider.llmConfigured,
        },
      });
    },
  };
};
