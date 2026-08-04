# LegalMind frontend integration guide

This is the authoritative frontend handoff for the HTTP API currently implemented
in `backend-ts`. The Postman collection contains all registered endpoints, including
Contract Analysis and Contract Generation.

## Import into Postman

1. Import `LegalMind-Frontend-API.postman_collection.json`.
2. Import either `LegalMind-Frontend-Local.postman_environment.json` or
   `LegalMind-Frontend-Production.postman_environment.json`.
3. Select the environment.
4. Set the environment values and run **Authentication / Login** first.

Login, refresh, and password reset automatically save `access_token`. Postman
keeps the HTTP-only refresh cookie in its cookie jar. The collection variables
`conversation_id`, `blog_id`, `bookmark_id`, and `comment_id` are used by
dependent requests.

## Verified backend endpoint inventory

The collection and backend endpoint registry both contain 40 HTTP endpoints.

### Service status (3)

| Method | Path | Frontend use |
|---|---|---|
| GET | `/` | Backend information; normally not needed by UI. |
| GET | `/health` | Liveness. May return 200 or 503. |
| GET | `/ready` | Database/provider readiness. May return 200 or 503. |

### Authentication (10)

| Method | Path | Authentication | Frontend use |
|---|---|---|---|
| POST | `/api/v1/auth/register` | Public | Register using JSON only. |
| POST | `/api/v1/auth/verify-email` | Public | Verify emailed token. |
| POST | `/api/v1/auth/resend-verification` | Public | Request another verification email. |
| POST | `/api/v1/auth/login` | Public | Receive `access_token` and HTTP-only refresh cookie. |
| POST | `/api/v1/auth/refresh-token` | Refresh cookie | Rotate refresh cookie and receive a new access token. |
| GET | `/api/v1/auth/me` | Bearer | Re-fetch the current public user. |
| POST | `/api/v1/auth/logout` | Refresh cookie | Revoke current session; returns 204. |
| POST | `/api/v1/auth/logout-all` | Bearer | Revoke every session; returns 204. |
| POST | `/api/v1/auth/forgot-password` | Public | Request password-reset email. |
| POST | `/api/v1/auth/reset-password` | Public | Reset password and create a session. |

### Legal query (1)

| Method | Path | Authentication | Frontend use |
|---|---|---|---|
| POST | `/api/v1/query` | Bearer | Stateless legal question; not stored in conversation history. |

### Conversations and chat (7)

| Method | Path | Frontend use |
|---|---|---|
| POST | `/api/v1/conversations` | Create a conversation. |
| GET | `/api/v1/conversations` | List owned conversations. |
| GET | `/api/v1/conversations/:conversationId` | Get one owned conversation. |
| GET | `/api/v1/conversations/:conversationId/messages` | Load message history. |
| POST | `/api/v1/conversations/:conversationId/messages` | Send and persist a message. |
| PATCH | `/api/v1/conversations/:conversationId` | Change title or archive state. |
| DELETE | `/api/v1/conversations/:conversationId` | Soft-delete; returns 204. |

Every conversation endpoint requires bearer authentication and enforces current
user/organization ownership.

### Profile, R2 avatar, and saved bookmarks (4)

| Method | Path | Frontend replacement |
|---|---|---|
| PATCH | `/api/v1/users/profile` | Replace `PATCH /api/users/profile`. |
| POST | `/api/v1/users/profile/avatar` | Replace `POST /api/users/profile/avatar`. |
| GET | `/api/v1/users/me/bookmarks` | Replace `GET /api/users/me/bookmarks`. |
| DELETE | `/api/v1/users/me/bookmarks/:bookmarkId` | Replace the old unversioned path. |

All four endpoints require bearer authentication.

### Blogs (11)

| Method | Path | Authentication | Frontend replacement |
|---|---|---|---|
| GET | `/api/v1/blogs` | Public | Replace `GET /api/blogs`. |
| GET | `/api/v1/blogs/categories` | Public | Replace the old categories path. |
| GET | `/api/v1/blogs/popular` | Public | Replace the old popular path. |
| GET | `/api/v1/blogs/trending` | Public | Replace the old trending path. |
| GET | `/api/v1/blogs/:blogId` | Optional bearer | Replace blog detail. |
| POST | `/api/v1/blogs` | Bearer | Create a blog. |
| GET | `/api/v1/blogs/me/my-blogs` | Bearer | List every status owned by the user. |
| PUT | `/api/v1/blogs/:blogId` | Bearer/author | Update an owned blog. |
| DELETE | `/api/v1/blogs/:blogId` | Bearer/author or admin | Delete; returns 204. |
| PATCH | `/api/v1/blogs/:blogId/status` | Admin bearer | Moderate status. |
| POST | `/api/v1/blogs/:blogId/bookmark` | Bearer | Toggle bookmark. |

### Comments (4)

| Method | Path | Authentication | Frontend replacement |
|---|---|---|---|
| GET | `/api/v1/blogs/:blogId/comments` | Public | Replace comment listing. |
| POST | `/api/v1/blogs/:blogId/comments` | Bearer | Add a comment to a published blog. |
| PUT | `/api/v1/comments/:commentId` | Bearer/author | Update an owned comment. |
| DELETE | `/api/v1/comments/:commentId` | Bearer/author or admin | Delete; returns 204. |

## Required frontend changes

These findings were checked against
`https://github.com/ALi-Maher-Mohamed/Legal-Mind-front` on `main`.

### 1. API base URL and paths

Set the frontend environment to the backend origin without a trailing slash:

```dotenv
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000
```

Do not set the value to `http://localhost:5001`. Do not include `/api/v1` in the
environment value when service methods already use `/api/v1/...` paths.

In `src/services/auth.service.ts`, replace every `/api/auth/*` path with
`/api/v1/auth/*`. In `src/services/users.service.ts` and the bookmark method in
`src/services/blogs.service.ts`, and `src/services/comments.service.ts`, replace
the old unversioned paths using the tables above.

### 2. Registration is JSON-only

Remove `buildRegisterFormData`, `lawyerIdDocument`, the Lawyer-ID upload UI, and
the validation that requires that file. Send:

```json
{
  "fullName": "Frontend User",
  "email": "user@example.com",
  "password": "ChangeMe123",
  "officeName": "Office name",
  "teamSize": "solo",
  "phone": "+201000000000",
  "barAssociationNumber": "12345"
}
```

`phone` and `barAssociationNumber` are optional. Password length is 8-128 and it
must contain lower-case, upper-case, and numeric characters. The backend rejects
unknown registration fields.

### 3. Success-response parsing

The current frontend expects the legacy `{ success, message, data }` envelope.
Current successful responses use direct top-level payloads. Important examples:

```ts
type AuthSessionResponse = {
  access_token: string;
  user: PublicUser;
};

type CurrentUserResponse = { user: PublicUser };
type ProfileResponse = { message: string; user: PublicUser };
```

Use `response.access_token` and `response.user`, not
`response.data.accessToken` or `response.data.user`. Do not require a success
message when the endpoint does not return one.

### 4. Secure session handling

Update `src/lib/api/client.ts` and `src/lib/api/session.ts`:

- Add `credentials: "include"` to browser requests.
- Keep the access token in application memory.
- Do not store access or refresh tokens in localStorage, sessionStorage, or
  JavaScript-readable cookies.
- Do not read or send `refreshToken` from frontend JavaScript.
- The backend owns the HTTP-only `legalmind_refresh_token` cookie.
- On the first 401, perform one refresh and retry the original request once.
- Concurrent 401 responses must share one refresh promise. Multiple simultaneous
  refresh calls can trigger refresh-token reuse protection.
- If refresh fails, clear frontend auth state and return to login.

The current Remember Me checkbox cannot change the backend refresh-cookie
lifetime. Hide/disable it or keep it presentation-only until a separate API is
designed.

### 5. Handle 204 and API errors

Logout, logout-all, conversation deletion, bookmark deletion, blog deletion,
and comment deletion return 204 with an empty body. Treat 204 as success and
return `undefined`; do not parse JSON.

Standard API failures are:

```ts
type ApiFailure = {
  success: false;
  error: string;
  message: string;
  details?: {
    fields?: Record<string, string[]>;
    issues?: Array<{ field: string; message: string; code: string }>;
  };
  request_id: string;
};
```

Display `message` or field issues, retain `error` for application decisions, and
include `request_id` in diagnostic logs. Rate-limit responses may have a
different body.

### 6. Update the public-user type

Use this API shape:

```ts
type PublicUser = {
  id: string;
  fullName: string;
  email: string;
  officeName: string;
  teamSize: "solo" | "small" | "medium" | "large";
  phone?: string;
  barAssociationNumber?: string;
  avatarUrl: string | null;
  isActive: boolean;
  isEmailVerified: boolean;
  organizationId: string | null;
  createdAt: string;
  updatedAt: string;
};
```

The UI may keep the mappings `fullName -> name`, `officeName -> firmName`, and
`barAssociationNumber -> barId`. All frontend accounts are lawyers, so no public
user-role field is returned. Remove API assumptions for `_id`, `avatar`,
`lawyerIdDocument`, `firstName`, `lastName`, `displayName`, and `lastLogin`.
`practiceAreas` is currently local UI state and is not persisted by this backend.

### 7. Profile editing

`PATCH /api/v1/users/profile` accepts at least one of:

```ts
{
  fullName?: string;
  officeName?: string;
  phone?: string;
  barAssociationNumber?: string;
  teamSize?: "solo" | "small" | "medium" | "large";
}
```

Do not send server-managed fields such as email, role, activation state,
verification state, organization ID, or avatar URL. Replace frontend user state
with the returned `user` after success.

### 8. Avatar upload to R2

Avatar upload is separate from registration and is the only current user/auth
multipart endpoint:

- `POST /api/v1/users/profile/avatar`
- Multipart field: `avatar`
- One JPEG, PNG, or WebP file
- Maximum 2 MB
- Do not manually set `Content-Type`; the browser must add the multipart boundary

The backend validates the file signature, uploads directly from memory to R2,
and returns the updated user. Display `user.avatarUrl`. The frontend must not
construct R2 keys or store the file locally.

### 9. Bookmarks

Toggle response:

```ts
{ bookmarked: boolean; action: "added" | "removed" }
```

List response:

```ts
{
  bookmarks: Array<{
    bookmark_id: string;
    blog_id: string;
    created_at: string;
    blog: { id: string; title: string; /* published blog projection */ };
  }>;
  pagination: { page: number; limit: number; total: number; pages: number };
}
```

Update `normalizeBookmark` to read `bookmark_id`, `blog_id`, and `created_at`.
Delete using `bookmark_id` and accept 204. Remove the current delete-then-toggle
fallback; it can unexpectedly change bookmark state.

The toggle requires an existing published blog. Blog creation, browsing, detail,
author updates, deletion, and moderation routes are now available below.

### 10. Blogs and comments

Update every path in `src/services/blogs.service.ts` and
`src/services/comments.service.ts` to `/api/v1`. Successful payloads are direct,
so use `response.blogs`, `response.blog`, `response.comments`, and
`response.comment`, not `response.data.*`.

Blog list filters are `page`, `limit`, `sort=newest|popular`, `search`,
`category`, and comma-separated `tags`. Public detail returns only published
blogs; an authenticated author may retrieve their own unpublished blog. Creating
and updating use strict JSON with title, content, optional excerpt/coverImage,
category, up to ten tags, and status `draft|pending|published`.

Only the author may update a blog. The author or an admin may delete it. Deleting
a blog also removes its comments and bookmarks. The moderation status endpoint
requires an admin account; `rejectionReason` is required for rejected status.

Comment listing is public for published blogs. Creating, updating, and deleting
require bearer authentication. Content is 1-1000 characters. Only the comment
author may update; the author or an admin may delete. Update the frontend author
avatar field from `avatar` to `avatarUrl`.

### 11. Legal query and conversations

Use `POST /api/v1/query` only for stateless questions. Its JSON fields are:

```ts
{
  query: string;          // 3-2000 characters
  top_k?: number;         // 1-50, default 5
  law_category?: string;
}
```

LegalMind is lawyer-only. Send only the fields shown above; the strict API
rejects unknown fields. Conversation creation and message requests likewise
have no audience-selection field.

For saved chat, create/list conversations and send messages through the
conversation endpoints. Every sent message needs a new UUID `idempotency_key`.
Reuse that UUID only when retrying exactly the same message. Preserve returned
opaque `next_cursor` values instead of parsing or generating them.

## Contract analysis and generation endpoints

The backend exposes full contract analysis and generation routes under `/api/v1/analyze/*` and `/api/v1/generate/*`. Both folders are included in the Postman collection.

## What can remain unchanged

- Existing Arabic labels, translations, layout, loading indicators, and toasts.
- Login and registration form layout after removing Lawyer-ID upload.
- Email verification, resend, forgot-password, and reset-password screens.
- Profile UI fields that map to supported profile properties.
- Avatar selection UI after changing only its endpoint and response handling.
- Bookmark UI after adapting paths and field names.
- Blog and comment UI after adapting versioned paths and direct response fields.
- Analysis and generation UI presentation while it remains explicitly mocked or
  disabled.

## Recommended frontend implementation order

1. Change the base URL and all supported paths.
2. Rewrite the shared response/error parser and support 204.
3. Add credentialed requests and in-memory access-token handling.
4. Add single-flight refresh and one retry after 401.
5. Update auth response and public-user types.
6. Convert registration to JSON and remove Lawyer-ID code/UI.
7. Connect profile editing and R2 avatar upload.
8. Adapt bookmark normalization, toggle, list, and deletion.
9. Connect blog browsing, author CRUD, bookmarks, and comments.
10. Connect legal query and conversation flows.
11. Disable analysis/generation network calls and run Postman end to end.

## Recommended Postman workflow

1. Health and readiness.
2. Register, verify email, and login.
3. Current user and profile edit.
4. Upload an avatar after configuring backend R2 credentials.
5. Ask a stateless legal question.
6. Create a conversation, send a message, list messages, update, and delete.
7. Create a blog, browse lists/detail, update it, and test its comments.
8. Toggle the blog bookmark, list bookmarks, then delete by `bookmark_id`.
9. Delete test comments/blogs before testing refresh and logout last.

Internal migrations, corpus imports, index setup, and evaluation scripts are not
HTTP endpoints and therefore do not belong in the Postman collection.
