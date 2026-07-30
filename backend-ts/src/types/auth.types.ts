import type { UserRole } from "../modules/users/user.types";

export type AuthenticatedUser = {
  id: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  isEmailVerified: boolean;
  organizationId: string | null;
};

