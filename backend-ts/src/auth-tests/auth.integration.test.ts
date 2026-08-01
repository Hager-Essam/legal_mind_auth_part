import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import jwt from "jsonwebtoken";
import { MongoMemoryServer } from "mongodb-memory-server";
import { env } from "../config/env";
import { AuthService } from "../modules/auth/auth.service";
import { AUTH_ERROR_CODES, AuthError } from "../modules/auth/auth.errors";
import { toPublicUser } from "../modules/auth/auth.mapper";
import { registerSchema } from "../modules/auth/auth.schemas";
import { RefreshTokenModel } from "../modules/refresh-tokens/refresh-token.model";
import { RefreshTokenRepository } from "../modules/refresh-tokens/refresh-token.repository";
import { UserModel } from "../modules/users/user.model";
import { UserRepository } from "../modules/users/user.repository";
import { EmailService } from "../services/email.service";
import { appConnection } from "../services/mongo.service";

let mongo: MongoMemoryServer;
let auth: AuthService;
let email: EmailService;

const registration = {
  fullName: "Test Lawyer",
  email: " Lawyer@Example.COM ",
  password: "SecurePass123",
  officeName: "Test Office",
  teamSize: "solo" as const,
  lawyerIdDocument: "uploads/private/lawyer-ids/test.pdf",
};

const tokenFromLastEmail = (): string => {
  const actionUrl = email.getLastDevelopmentEmail()?.actionUrl;
  assert.ok(actionUrl);
  const token = new URL(actionUrl).searchParams.get("token");
  assert.ok(token);
  return token;
};

const registerAndVerify = async () => {
  const user = await auth.register(registration);
  await auth.verifyEmail(tokenFromLastEmail());
  return (await UserModel.findById(user._id))!;
};

before(async () => {
  mongo = await MongoMemoryServer.create({
    instance: {
      // MongoDB defaults to reserving 500 MB before an index build. Keep the
      // production default, but lower it for this disposable local test server
      // so the suite remains runnable in small CI/workspace volumes.
      args: ["--setParameter", "indexBuildMinAvailableDiskSpaceMB=50"],
    },
  });
  await appConnection.openUri(mongo.getUri(), { dbName: "legalmind_app_test" });
  await UserModel.syncIndexes();
  await RefreshTokenModel.syncIndexes();
  const users = new UserRepository();
  const refreshTokens = new RefreshTokenRepository();
  email = new EmailService("console");
  auth = new AuthService(users, refreshTokens, email);
});

beforeEach(async () => {
  await Promise.all([UserModel.deleteMany({}), RefreshTokenModel.deleteMany({})]);
});

after(async () => {
  await appConnection.dropDatabase();
  await appConnection.close();
  await mongo.stop();
});

test("registration normalizes email, hashes passwords, and assigns role server-side", async () => {
  const user = await auth.register(registration);
  assert.equal(user.email, "lawyer@example.com");
  assert.equal(user.role, "pending_lawyer");
  const stored = await UserModel.findById(user._id).select("+password");
  assert.ok(stored);
  assert.notEqual(stored.password, registration.password);
  assert.equal(await stored.comparePassword(registration.password), true);
});

test("duplicate normalized emails are rejected", async () => {
  await auth.register(registration);
  await assert.rejects(
    auth.register({ ...registration, email: "lawyer@example.com" }),
    (error) =>
      error instanceof AuthError &&
      error.code === AUTH_ERROR_CODES.emailAlreadyExists,
  );
});

test("public registration schema rejects privileged fields", () => {
  const parsed = registerSchema.safeParse({
    ...registration,
    role: "admin",
    organizationId: "attacker-org",
    isEmailVerified: true,
  });
  assert.equal(parsed.success, false);
});

test("login requires verification and returns hashed refresh-token storage", async () => {
  await auth.register(registration);
  await assert.rejects(
    auth.login("lawyer@example.com", registration.password),
    (error) =>
      error instanceof AuthError &&
      error.code === AUTH_ERROR_CODES.emailNotVerified,
  );
  await auth.verifyEmail(tokenFromLastEmail());
  const session = await auth.login(
    "LAWYER@example.com",
    registration.password,
  );
  assert.ok(session.accessToken);
  assert.ok(session.refreshToken);
  const rawRecord = await appConnection.db!
    .collection("refresh_tokens")
    .findOne({});
  assert.ok(rawRecord);
  assert.equal("token" in rawRecord, false);
  assert.notEqual(rawRecord.tokenHash, session.refreshToken);
});

test("refresh rotation invalidates the old token and detects reuse", async () => {
  await registerAndVerify();
  const first = await auth.login(
    "lawyer@example.com",
    registration.password,
  );
  const second = await auth.refreshToken(first.refreshToken);
  assert.notEqual(second.refreshToken, first.refreshToken);
  await assert.rejects(
    auth.refreshToken(first.refreshToken),
    (error) =>
      error instanceof AuthError &&
      error.code === AUTH_ERROR_CODES.refreshTokenReused,
  );
  await assert.rejects(
    auth.refreshToken(second.refreshToken),
    (error) =>
      error instanceof AuthError &&
      [
        AUTH_ERROR_CODES.refreshTokenReused,
        AUTH_ERROR_CODES.refreshTokenInvalid,
      ].includes(error.code as never),
  );
});

test("JWT verification restricts signature, issuer, audience, and algorithm", async () => {
  const user = await registerAndVerify();
  const valid = auth.generateAccessToken(user);
  assert.equal(auth.verifyAccessToken(valid).sub, user._id.toString());

  const basePayload = {
    sub: user._id.toString(),
    email: user.email,
    role: user.role,
  };
  const invalidTokens = [
    jwt.sign(basePayload, "another-secret-another-secret-1234", {
      algorithm: "HS256",
      issuer: "legalmind-api",
      audience: "legalmind-web",
    }),
    jwt.sign(basePayload, env.jwtSecret, {
      algorithm: "HS256",
      issuer: "wrong-issuer",
      audience: "legalmind-web",
    }),
    jwt.sign(basePayload, env.jwtSecret, {
      algorithm: "HS256",
      issuer: "legalmind-api",
      audience: "wrong-audience",
    }),
    jwt.sign(basePayload, env.jwtSecret, {
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

test("password reset revokes old sessions and creates a fresh one", async () => {
  await registerAndVerify();
  const oldSession = await auth.login(
    "lawyer@example.com",
    registration.password,
  );
  await auth.forgotPassword("lawyer@example.com");
  const reset = await auth.resetPassword(
    tokenFromLastEmail(),
    "NewSecurePass456",
  );
  assert.ok(reset.accessToken);
  await assert.rejects(auth.refreshToken(oldSession.refreshToken));
  const login = await auth.login("lawyer@example.com", "NewSecurePass456");
  assert.ok(login.accessToken);
});

test("public user mapper excludes all sensitive fields and lawyer document path", async () => {
  const user = await registerAndVerify();
  const publicUser = toPublicUser(user);
  const serialized = JSON.stringify(publicUser);
  for (const forbidden of [
    "password",
    "TokenHash",
    "lawyerIdDocument",
    "refresh",
    "__v",
  ]) {
    assert.equal(serialized.includes(forbidden), false);
  }
});

test("required user and refresh-token indexes exist", async () => {
  const userIndexes = await UserModel.collection.indexes();
  const refreshIndexes = await RefreshTokenModel.collection.indexes();
  assert.ok(userIndexes.some((index) => index.name === "users_email_unique"));
  assert.ok(userIndexes.some((index) => index.name === "users_role_active"));
  assert.ok(
    refreshIndexes.some(
      (index) =>
        index.name === "refresh_tokens_expiry_ttl" &&
        index.expireAfterSeconds === 0,
    ),
  );
});
