import { Router } from "express";
import type { AuthService } from "../auth/auth.service";
import { authenticate } from "../auth/auth.middleware";
import type { UserRepository } from "../auth/users/user.repository";
import type { DashboardService } from "./dashboard.service";
import { createDashboardController } from "./dashboard.controller";

export type DashboardRouteDependencies = {
  authService: AuthService;
  userRepository: UserRepository;
  dashboardService: DashboardService;
};

export const createDashboardRouter = (services: DashboardRouteDependencies) => {
  const router = Router();
  const dashboard = createDashboardController(services.dashboardService);
  const required = authenticate(services.authService, services.userRepository);

  router.get("/activity", required, dashboard.activity);

  return router;
};
