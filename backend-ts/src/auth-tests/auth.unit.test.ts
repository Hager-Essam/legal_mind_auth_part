import assert from "node:assert/strict";
import { test } from "node:test";
import { Types } from "mongoose";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { AuthService, hashRefreshToken } from "../modules/auth/auth.service";
import { AUTH_ERROR_CODES, AuthError } from "../modules/auth/auth.errors";
import { toPublicUser } from "../modules/auth/auth.mapper";
import { registerSchema } from "../modules/auth/auth.schemas";
import { refreshTokenSchema } from "../modules/auth/refresh-tokens/refresh-token.schema";
import { UserModel } from "../modules/auth/users/user.model";
import { userSchema } from "../modules/auth/users/user.schema";
import type { UserDocument } from "../modules/auth/users/user.types";
import { ChunkModel } from "../modules/legal-corpus/chunk.model";
import {
  appConnection,
  ragConnection,
} from "../infrastructure/mongo/mongo.service";
import type { UserRepository } from "../modules/auth/users/user.repository";
import type { RefreshTokenRepository } from "../modules/auth/refresh-tokens/refresh-token.repository";
import type { AuthEmailSender } from "../modules/auth/auth.service";

const createAuthService = (): AuthService =>
  new AuthService(
    {} as UserRepository,
    {} as RefreshTokenRepository,
    {} as AuthEmailSender,
  );

const fakeUser = {
  _id: new Types.ObjectId(),
  fullName: "Test Lawyer",
  email: "lawyer@example.com",
  password: "hidden",
  role: "lawyer",
  isActive: true,
  isEmailVerified: true,
  organizationId: null,
  officeName: "Office",
  teamSize: "solo",
  phone: "01000000000",
  barAssociationNumber: "BAR-1",
  lawyerIdDocument: "private/credential.pdf",
  emailVerificationTokenHash: "verification-hash",
  passwordResetTokenHash: "reset-hash",
  createdAt: new Date(),
  updatedAt: new Date(),
} as unknown as UserDocument;

test("public registration rejects non-public fields", () => {
  for (const injected of [
    { role: "admin" },
    { organizationId: "attacker-org" },
    { isActive: true },
    { isEmailVerified: true },
    { lawyerIdDocument: "credential.pdf" },
  ]) {
    const result = registerSchema.safeParse({
      fullName: "Test Lawyer",
      email: "lawyer@example.com",
      password: "SecurePass123",
      officeName: "Office",
      teamSize: "solo",
      ...injected,
    });
    assert.equal(result.success, false);
  }
});

test("email parsing normalizes case and whitespace", () => {
  const result = registerSchema.parse({
    fullName: "Test Lawyer",
    email: " Lawyer@Example.COM ",
    password: "SecurePass123",
    officeName: "Office",
    teamSize: "solo",
  });
  assert.equal(result.email, "lawyer@example.com");
});

test("refresh-token hashing is deterministic and never returns the raw token", () => {
  const token = "raw-refresh-token-value";
  const first = hashRefreshToken(token);
  assert.equal(first, hashRefreshToken(token));
  assert.notEqual(first, token);
  assert.match(first, /^[a-f0-9]{64}$/);
});

test("access tokens enforce HS256 issuer and audience", () => {
  const auth = createAuthService();
  const valid = auth.generateAccessToken(fakeUser);
  assert.equal(auth.verifyAccessToken(valid).sub, fakeUser._id.toString());

  const payload = {
    sub: fakeUser._id.toString(),
    email: fakeUser.email,
    role: fakeUser.role,
  };
  const invalidTokens = [
    jwt.sign(payload, "different-secret-different-secret-1234", {
      algorithm: "HS256",
      issuer: "legalmind-api",
      audience: "legalmind-web",
    }),
    jwt.sign(payload, env.jwtSecret, {
      algorithm: "HS256",
      issuer: "wrong",
      audience: "legalmind-web",
    }),
    jwt.sign(payload, env.jwtSecret, {
      algorithm: "HS256",
      issuer: "legalmind-api",
      audience: "wrong",
    }),
    jwt.sign(payload, env.jwtSecret, {
      algorithm: "HS384",
      issuer: "legalmind-api",
      audience: "legalmind-web",
    }),
  ];

  for (const token of invalidTokens) {
    assert.throws(
      () => auth.verifyAccessToken(token),
      (error) =>
        error instanceof AuthError &&
        error.code === AUTH_ERROR_CODES.invalidToken,
    );
  }
});

test("public user mapping excludes credentials, hashes, and internal fields", () => {
  const serialized = JSON.stringify(toPublicUser(fakeUser));

  for (const forbidden of [
    "password",
    "TokenHash",
    "lawyerIdDocument",
    "__v",
  ]) {
    assert.equal(serialized.includes(forbidden), false);
  }
});

test("models are bound to the correct logical connections", () => {
  assert.equal(UserModel.db, appConnection);
  assert.equal(ChunkModel.db, ragConnection);
  assert.notEqual(UserModel.db, ChunkModel.db);
});

test("required user and refresh-token indexes are declared", () => {
  const userIndexes = userSchema.indexes();
  const refreshIndexes = refreshTokenSchema.indexes();
  assert.ok(
    userIndexes.some(
      ([keys, options]) => keys.email === 1 && options.unique === true,
    ),
  );
  assert.ok(
    userIndexes.some(([keys]) => keys.role === 1 && keys.isActive === 1),
  );
  assert.ok(
    refreshIndexes.some(
      ([keys, options]) =>
        keys.expiresAt === 1 && options.expireAfterSeconds === 0,
    ),
  );
});
