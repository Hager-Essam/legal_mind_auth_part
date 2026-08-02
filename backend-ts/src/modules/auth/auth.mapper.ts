import type { UserDocument } from "./users/user.types";

export const toPublicUser = (user: UserDocument) => ({
  id: user._id.toString(),
  fullName: user.fullName,
  email: user.email,
  role: user.role,
  officeName: user.officeName,
  teamSize: user.teamSize,
  phone: user.phone,
  avatarUrl: user.avatarUrl ?? null,
  barAssociationNumber: user.barAssociationNumber,
  isActive: user.isActive,
  isEmailVerified: user.isEmailVerified,
  organizationId: user.organizationId ?? null,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});
