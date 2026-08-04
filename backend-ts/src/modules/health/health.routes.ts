import { Router } from "express";
import { createHealthController, type HealthDependencies } from "./health.controller";

export const createHealthRouter = (services: HealthDependencies) => {
  const router = Router();
  const controller = createHealthController(services);
  router.get("/health", controller.health);
  router.get("/ready", controller.readiness);

  return router;
};
