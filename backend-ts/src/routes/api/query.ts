import { Router } from "express";

import { createQueryController } from "../../controllers/query.controller";
import type { AppServices } from "../../services/service-container";

export const createQueryRouter = (services: AppServices) =>
{
  const router = Router();
  // Rate limiter temporarily disabled for debugging
  router.post("/query", createQueryController(services));
  return router;
};
