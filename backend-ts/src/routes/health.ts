import { Router } from "express";

import { createHealthController } from "../controllers/health.controller";
import type { AppServices } from "../services/service-container";

export const createHealthRouter = (services: AppServices) => {
  const router = Router();
  const controller = createHealthController(services);

  router.get("/health", controller.health);
  router.get("/ready", controller.readiness);

  return router;
};
