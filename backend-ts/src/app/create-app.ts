import cors from "cors";
import express from "express";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import { env } from "../config/env";
import { errorHandler, notFoundHandler } from "../shared/http/error-handler";
import { createQueryRouter } from "../modules/legal-query/query.routes";
import { createHealthRouter } from "../modules/health/health.routes";
import type { AppServices } from "../services/service-container";
import { createAuthRouter } from "../modules/auth/auth.routes";
import { createConversationRouter } from "../modules/conversations/conversation.routes";
import { requestIdMiddleware } from "../shared/http/request-id.middleware";
import { HttpError } from "../shared/http/http-error";
import { createUserRouter } from "../modules/users/user.routes";
import { createBlogBookmarkRouter, createUserBookmarkRouter } from "../modules/bookmarks/bookmark.routes";
import { createBlogRouter } from "../modules/blogs/blog.routes";
import { createCommentRouter } from "../modules/comments/comment.routes";
import { createContractAnalysisRouter } from "../modules/contract-analysis/contract-analysis.routes";
import { createContractGenerationRouter } from "../modules/contract-generation/contract-generation.routes";

export const createApp = (services: AppServices) => {
  const app = express();
  app.set("trust proxy", 1);
  const corsOptions = {
    origin: (origin: string | undefined, callback: (error: Error | null, allowed?: boolean) => void) => {
      if (!origin || env.corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new HttpError(403, "The request origin is not allowed.", undefined, "CORS_ORIGIN_DENIED"));
    },
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization", "ngrok-skip-browser-warning"],
  };

  app.use(requestIdMiddleware);
  app.use(cors(corsOptions));
  app.use(express.json({ limit: "2mb" }));
  app.use(cookieParser());

  if (env.nodeEnv !== "test") {
    app.use(
      morgan("[:date[iso]] :method :url :status :response-time ms - :res[content-length]", {
        skip: (req) => req.url === "/health",
      })
    );
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
        "/api/v1/users",
        "/api/v1/blogs",
        "/api/v1/comments",
        "/api/v1/analyze",
        "/api/v1/generate",
      ],
    });
  });

  app.use(createHealthRouter(services));
  app.use("/api/v1/auth", createAuthRouter(services));
  app.use("/api/v1/users", createUserRouter(services));
  app.use("/api/v1/users", createUserBookmarkRouter(services));
  app.use("/api/v1/blogs", createBlogRouter(services));
  app.use("/api/v1/blogs", createBlogBookmarkRouter(services));
  app.use("/api/v1/comments", createCommentRouter(services));
  app.use("/api/v1/conversations", createConversationRouter(services));
  app.use("/api/v1", createQueryRouter(services));
  app.use("/api/v1", createContractAnalysisRouter(services));
  app.use("/api/v1", createContractGenerationRouter(services));
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
