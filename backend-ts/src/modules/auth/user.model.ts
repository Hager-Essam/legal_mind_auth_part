import { appConnection } from "../../services/mongo.service";
import { userSchema } from "./user.schema";
import type { UserDocument } from "./user.types";

export const UserModel = appConnection.model<UserDocument>("User", userSchema);
