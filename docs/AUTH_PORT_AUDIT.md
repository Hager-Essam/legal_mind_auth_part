# LegalMind Authentication Port Audit

Date: 2026-07-30

Target repository: `C:\Users\IRON LAPTOP\Desktop\Grad`

Source authentication repository:
`C:\Users\IRON LAPTOP\Desktop\New folder\legal_mind_auth_part`

Target branch: `feature/auth-persistent-legal-chat`

## Baseline

| Command | Result | Notes |
| --- | --- | --- |
| `npm install` | Passed | No reported vulnerabilities. |
| `npm run typecheck` | Passed | Existing TypeScript code typechecks. |
| `npm run build` | Passed | Existing TypeScript code builds. |
| `npm run test:contract-audit` | Not available | The target `package.json` has no such script. |
| `npm run test:corpus-v2` | Not available | The target `package.json` has no such script. |

The target repository currently contains a small RAG/query backend. It has no
tracked contract-analysis module and no tracked frontend source. The untracked
`frontend/` directory contains only a built bundle and a development log and
will not be modified until frontend source is available.

## Authentication dependency inventory

| Source file | Dependency | Existing LegalMind equivalent | Action | Destination path | Notes |
| --- | --- | --- | --- | --- | --- |
| `auth.controller.ts` | Express request/response types | Express 5 types | Reuse | `src/modules/auth/auth.controller.ts` | Remove all `any` request-user casts. |
| `auth.controller.ts` | `auth.service.ts` | None | Adapt | `src/modules/auth/auth.service.ts` | Use dependency injection through the existing service container. |
| `auth.controller.ts` | `ResponseHelper` | Existing JSON error responses | Replace | Existing error/response convention | Keep one response convention. |
| `auth.controller.ts` | refresh cookie options | None | Adapt | `src/modules/auth/auth.cookies.ts` | Centralize path, lifetime, SameSite and Secure settings. |
| `auth.middleware.ts` | `auth.service.ts` | None | Adapt | `src/modules/auth/auth.middleware.ts` | Strict JWT verification and Zod payload validation. |
| `auth.middleware.ts` | user repository | None | Port/adapt | `src/modules/users/user.repository.ts` | Load from `appConnection`; attach a safe typed user. |
| `auth.middleware.ts` | `ResponseHelper` | `HttpError`/error handler | Replace | `src/errors/http-error.ts` | Use stable auth error codes. |
| `auth.routes.ts` | Express router | Existing Express router factories | Reuse | `src/modules/auth/auth.routes.ts` | Mount at `/api/v1/auth`. |
| `auth.routes.ts` | Joi validation middleware | Zod is already installed | Replace | `src/middlewares/validation.middleware.ts` | Convert all auth schemas to Zod. |
| `auth.routes.ts` | lawyer-ID upload middleware | None | Adapt | `src/middlewares/upload.middleware.ts` | Private directory, random names, strict MIME/extension checks, cleanup. |
| `auth.routes.ts` | authentication middleware | None | Adapt | `src/modules/auth/auth.middleware.ts` | Include `authenticate`, `authorize`, `optionalAuth`. |
| `auth.service.ts` | `jsonwebtoken` | None | Add | `src/modules/auth/auth.service.ts` | HS256, issuer, audience and typed `sub` payload. |
| `auth.service.ts` | Node `crypto` | Available | Reuse | Auth/user/token modules | Hash reset, verification and refresh tokens with SHA-256. |
| `auth.service.ts` | source env module | Existing Zod env module | Replace | `src/config/env.ts` | Extend the existing `env`; do not copy source config. |
| `auth.service.ts` | user repository/model | None | Port/adapt | `src/modules/users/*` | Preserve bcrypt behavior and add required SaaS-ready fields/indexes. |
| `auth.service.ts` | refresh-token repository/model | None | Port/adapt | `src/modules/refresh-tokens/*` | Replace raw-token storage with token hashes and atomic rotation. |
| `auth.service.ts` | `AppError` | `HttpError` | Adapt | `src/errors/http-error.ts` | Add stable `code` while retaining target handler. |
| `auth.service.ts` | HTTP status constants | Numeric status use | Replace | Call sites | A second constants system is unnecessary. |
| `auth.service.ts` | error-message constants | None | Adapt | `src/modules/auth/auth.errors.ts` | Stable codes and safe messages. |
| `auth.service.ts` | email service | None | Port/adapt | `src/services/email.service.ts` | Configurable frontend URL; console mode without production token logging. |
| `auth.validator.ts` | Joi | Zod | Replace | `src/modules/auth/auth.schemas.ts` | Reject privileged registration fields. |
| `user.model.ts` | global Mongoose model | Existing global corpus model | Replace | `src/modules/users/user.model.ts` | Bind exclusively to `appConnection`. |
| `user.model.ts` | bcrypt | None | Add | `src/modules/users/user.model.ts` | Preserve bcrypt with cost 10. |
| `user.model.ts` | password/reset/verification methods | None | Adapt | User model/repository | Rename stored token fields to explicit `*TokenHash`. |
| `user.model.ts` | legacy name/avatar fields | None | Do not port | N/A | Authentication does not require them. |
| `user.repository.ts` | source User model | None | Port/adapt | `src/modules/users/user.repository.ts` | Normalize email in every applicable operation. |
| `refresh-token.model.ts` | global Mongoose model | None | Replace | `src/modules/refresh-tokens/refresh-token.model.ts` | Bind to `appConnection`; add TTL and rotation metadata. |
| `refresh-token.repository.ts` | raw token lookup/storage | None | Replace | `src/modules/refresh-tokens/refresh-token.repository.ts` | Store and query only SHA-256 hashes. |
| `email.service.ts` | Nodemailer | None | Add only if SMTP mode is enabled | `src/services/email.service.ts` | Source hardcodes a production frontend URL and logs action URLs in development; both require adaptation. |
| `email.service.ts` | HTML email templates | None | Adapt | `src/services/email.service.ts` | Use small maintained templates instead of copying mojibake output. |
| `upload.middleware.ts` | Multer | None | Add | `src/middlewares/upload.middleware.ts` | Source allows WebP and uses a public upload path; target must allow only PDF/JPG/JPEG/PNG privately. |
| `validation.middleware.ts` | Joi and `ResponseHelper` | Zod and existing error handler | Replace | `src/middlewares/validation.middleware.ts` | Parsed values replace `req.body`. |
| `response.helper.ts` | Response envelope | Existing target responses | Replace | Existing controllers/error handler | Do not introduce duplicate response infrastructure. |
| `app.error.ts` | Operational application errors | `HttpError` | Adapt | `src/errors/http-error.ts` | Preserve one error hierarchy. |
| `http-status.ts` | Status constants | Direct status codes | Replace | N/A | Avoid duplicate infrastructure. |
| `error-messages.ts` | User-facing messages | None | Adapt | `src/modules/auth/auth.errors.ts` | Source text is mojibake; use safe UTF-8/English API messages. |
| `config/env.ts` | dotenv configuration | Existing Zod env | Replace | `src/config/env.ts` | Existing LegalMind configuration remains authoritative. |
| `types/custom.d.ts` | Express augmentation with `any` | None | Replace | `src/types/express.d.ts` | Strong `AuthenticatedUser` type. |
| `app.ts` | bootstrap, CORS, static files, Swagger | Existing app factory | Do not port | `src/app/create-app.ts` | Only mount adapted auth middleware/routes. |
| `config/db.ts` | global Mongoose connection | Existing `MongoService` | Do not port | `src/services/mongo.service.ts` | Existing service will be extended to explicit app/RAG connections. |
| `error-handler.middleware.ts` | global source handler | Existing handler | Do not port | `src/middlewares/error-handler.ts` | Extend target behavior safely. |

## Source behavior and gaps

- Passwords use `bcrypt` with cost 10 and are excluded by default.
- Password and email-verification tokens are random raw values whose SHA-256
  hashes are stored.
- The source refresh-token collection stores raw tokens. This must not be
  carried over.
- Source JWTs contain `id`, do not restrict algorithm/issuer/audience, and use
  an insecure development default. This must be replaced with the required
  `sub`, `email`, and `role` payload.
- Source public registration accepts `role`; this is a privilege-injection
  risk and must be rejected.
- Source registration defaults directly to `lawyer`. The unified backend will
  default public registrations to `pending_lawyer`.
- Source refresh rotation creates the replacement before revoking the old
  token and is not atomic. The target implementation must make reuse and
  concurrent rotation safe.
- Source password reset does not revoke prior sessions. The target must revoke
  all refresh tokens.
- Source upload storage is publicly served, accepts WebP, and lacks orphan-file
  cleanup. These behaviors must not be copied.
- Source CORS permits wildcard origins with credentials and must not be copied.
- Source email configuration hardcodes a deployed frontend URL and logs full
  action URLs in development. The target will use the LegalMind env system and
  an explicit console-email mode.
- Source application bootstrap, Swagger setup, unrelated blog/bookmark/user
  profile modules, contract modules, R2 storage, and global Mongoose connection
  are outside the authentication port.

## Existing target infrastructure to preserve

- `src/app/create-app.ts` remains the only Express application factory.
- `src/config/env.ts` remains the only environment configuration system.
- `src/errors/http-error.ts` and `src/middlewares/error-handler.ts` remain the
  only global error path.
- `src/services/service-container.ts` remains the only service container.
- `MongoService` remains responsible for lifecycle and health checks.
- Existing RAG/query, retrieval, reranking, generation, classification,
  evaluation, and legal-reference files remain in place.

## Phase 0 conclusion

Every direct and transitive authentication dependency has a destination or an
explicit replace/do-not-port decision. No source authentication import remains
unclassified.
