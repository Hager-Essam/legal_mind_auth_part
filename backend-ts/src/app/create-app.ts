import cors from "cors";
import express from "express";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import { env } from "../config/env";
import { errorHandler, notFoundHandler } from "../middlewares/error-handler";
import { createQueryRouter } from "../routes/api/query";
import { createHealthRouter } from "../routes/health";
import type { AppServices } from "../services/service-container";
import { createAuthRouter } from "../modules/auth/auth.routes";
import { createConversationRouter } from "../modules/conversations/conversation.routes";

export const createApp = (services: AppServices) => {
  const app = express();
  const corsOptions = {
    origin: (
      origin: string | undefined,
      callback: (error: Error | null, allowed?: boolean) => void,
    ) => {
      if (!origin || env.corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("Origin is not allowed by CORS."));
    },
    credentials: true,
  };

  app.use(cors(corsOptions));
  app.use(express.json({ limit: "2mb" }));
  app.use(cookieParser());

  if (env.nodeEnv !== "test") {
    app.use(morgan("[:date[iso]] :method :url :status :response-time ms - :res[content-length]", { skip: (req) => req.url === "/health" }));
  }

  app.get("/", (_req, res) => {
    res.json({
      name: env.appName,
      version: "0.1.0",
      routes: [
        "/health",
        "/ready",
        "/api/v1/auth",
        "/api/v1/query",
        "/api/v1/conversations",
      ],
    });
  });

  app.use(createHealthRouter(services));
  app.use("/api/v1/auth", createAuthRouter(services));
  app.use(
    "/api/v1/conversations",
    createConversationRouter(services),
  );
  app.use("/api/v1", createQueryRouter(services));
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
};
