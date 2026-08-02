import type { UserRole } from "./users/user.types";

export type AccessTokenPayload = {
  sub: string;
  email: string;
  role: UserRole;
};

export type RegisterInput = {
  fullName: string;
  email: string;
  password: string;
  officeName: string;
  teamSize: "solo" | "small" | "medium" | "large";
  phone?: string;
  barAssociationNumber?: string;
};
