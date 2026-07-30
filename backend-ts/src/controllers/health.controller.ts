import type { Request, Response } from "express";
import { env } from "../config/env";
import type { AppServices } from "../services/service-container";

export const createHealthController = (services: AppServices) => {
  return {
    health: async (_req: Request, res: Response) => {
      const mongo = await services.mongoService.health();
      const ok = mongo.app.pingOk && mongo.rag.pingOk;
      res.status(ok ? 200 : 503).json({
        status: ok ? "ok" : "degraded",
        service: env.appName,
        environment: env.nodeEnv,
        checks: { applicationDatabase: mongo.app, ragDatabase: mongo.rag },
      });
    },
    readiness: async (_req: Request, res: Response) => {
      const mongo = await services.mongoService.health();
      const provider = services.providerConfigService.getSummary();
      const mongoReady = mongo.app.pingOk && mongo.rag.pingOk;
      const ok = mongoReady && provider.llmConfigured;
      res.status(ok ? 200 : 503).json({
        status: ok ? "ok" : "degraded",
        checks: {
          applicationDatabase: mongo.app.pingOk,
          ragDatabase: mongo.rag.pingOk,
          provider: provider.llmConfigured,
        },
      });
    },
  };
};
