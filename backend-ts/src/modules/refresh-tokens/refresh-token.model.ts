import { appConnection } from "../../services/mongo.service";
import {
  refreshTokenSchema,
  type RefreshToken,
} from "./refresh-token.schema";

export const RefreshTokenModel = appConnection.model<RefreshToken>(
  "RefreshToken",
  refreshTokenSchema,
);

