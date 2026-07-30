import crypto from "node:crypto";
import { MongoService, appConnection } from "../services/mongo.service";
import { isDryRun, printSummary } from "./script-utils";

const hash = (value: string): string =>
  crypto.createHash("sha256").update(value).digest("hex");

const run = async (): Promise<void> => {
  const dryRun = isDryRun();
  const mongo = new MongoService();
  await mongo.connect();
  try {
    const users = appConnection.db!.collection("users");
    const refreshTokens = appConnection.db!.collection("refresh_tokens");
    let usersChanged = 0;
    let tokensChanged = 0;

    const userCursor = users.find({
      $or: [
        { lastLogin: { $exists: true } },
        { passwordResetToken: { $exists: true } },
        { emailVerificationToken: { $exists: true } },
        { organizationId: { $exists: false } },
      ],
    });
    for await (const user of userCursor) {
      const set: Record<string, unknown> = {};
      const unset: Record<string, ""> = {};
      if (user.lastLogin && !user.lastLoginAt) {
        set.lastLoginAt = user.lastLogin;
        unset.lastLogin = "";
      }
      if (user.passwordResetToken && !user.passwordResetTokenHash) {
        set.passwordResetTokenHash = user.passwordResetToken;
        unset.passwordResetToken = "";
      }
      if (
        user.emailVerificationToken &&
        !user.emailVerificationTokenHash
      ) {
        set.emailVerificationTokenHash = user.emailVerificationToken;
        unset.emailVerificationToken = "";
      }
      if (!("organizationId" in user)) set.organizationId = null;
      if (typeof user.email === "string") {
        set.email = user.email.trim().toLowerCase();
      }
      if (!dryRun) {
        await users.updateOne(
          { _id: user._id },
          {
            ...(Object.keys(set).length ? { $set: set } : {}),
            ...(Object.keys(unset).length ? { $unset: unset } : {}),
          },
        );
      }
      usersChanged += 1;
    }

    const tokenCursor = refreshTokens.find({
      $or: [
        { token: { $exists: true } },
        { user: { $exists: true } },
        { replacedByToken: { $exists: true } },
        { isActive: { $exists: true } },
      ],
    });
    for await (const token of tokenCursor) {
      const set: Record<string, unknown> = {};
      const unset: Record<string, ""> = {};
      if (typeof token.token === "string" && !token.tokenHash) {
        set.tokenHash = hash(token.token);
        unset.token = "";
      }
      if (token.user && !token.userId) {
        set.userId = token.user;
        unset.user = "";
      }
      if (
        typeof token.replacedByToken === "string" &&
        !token.replacedByTokenHash
      ) {
        set.replacedByTokenHash = hash(token.replacedByToken);
        unset.replacedByToken = "";
      }
      if (token.isActive === false && !token.revokedAt) {
        set.revokedAt = token.updatedAt ?? new Date();
      }
      if ("isActive" in token) unset.isActive = "";
      if (!dryRun) {
        await refreshTokens.updateOne(
          { _id: token._id },
          {
            ...(Object.keys(set).length ? { $set: set } : {}),
            ...(Object.keys(unset).length ? { $unset: unset } : {}),
          },
        );
      }
      tokensChanged += 1;
    }
    printSummary("migrate:auth", {
      dryRun,
      usersChanged,
      tokensChanged,
      failed: 0,
    });
  } finally {
    await mongo.close();
  }
};

run().catch((error) => {
  console.error(
    `migrate:auth failed: ${error instanceof Error ? error.message : "unknown error"}`,
  );
  process.exitCode = 1;
});

