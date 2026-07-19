import cors from "cors";
import express from "express";
import morgan from "morgan";
import { env } from "../config/env";
import { errorHandler, notFoundHandler } from "../middlewares/error-handler";
import { createQueryRouter } from "../routes/api/query";
import { createHealthRouter } from "../routes/health";
import type { AppServices } from "../services/service-container";

export const createApp = (services: AppServices) => {
  const app = express();
  const corsOptions = env.corsOrigins.length === 0
    ? { origin: true, credentials: true }
    : { origin: env.corsOrigins, credentials: true };

  app.use(cors(corsOptions));
  app.use(express.json({ limit: "2mb" }));
  app.use((req, _res, next) => { console.log(`[DEBUG] ${req.method} ${req.url}`); next(); });

  if (env.nodeEnv !== "test") {
    app.use(morgan("[:date[iso]] :method :url :status :response-time ms - :res[content-length]", { skip: (req) => req.url === "/health" }));
  }

  app.get("/", (_req, res) => {
    res.json({ name: env.appName, environment: env.nodeEnv, version: "0.1.0", provider_summary: services.providerConfigService.getSummary(), routes: ["/health", "/ready", "/api/v1/query"] });
  });

  app.use(createHealthRouter(services));
  app.use("/api/v1", createQueryRouter(services));
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
};
