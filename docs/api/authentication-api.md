# Authentication API

Base: `/api/v1/auth`.

| Method/path | Body | Auth / limit | Success |
|---|---|---|---|
| `POST /register` | JSON lawyer profile | public; 5/hour | 201 message + user |
| `POST /verify-email` | `{token}` | public | message |
| `POST /resend-verification` | `{email}` | public; 5/hour | generic message |
| `POST /login` | `{email,password}` | public; 10/15 min | access token + user; cookie |
| `POST /refresh-token` | optional `{refreshToken}` | public; 30/min | rotated access token + user; cookie |
| `POST /logout` | optional refresh token | public | 204; clears cookie |
| `POST /logout-all` | none | bearer | 204; revokes sessions |
| `POST /forgot-password` | `{email}` | public; 5/hour | generic message |
| `POST /reset-password` | `{token,password}` | public | message + access token + user; cookie |
| `GET /me` | none | bearer | `{user}` |

Registration text fields are `fullName` (2..100), `email`, strong `password`
(8..128 with lower/upper/digit), `officeName` (1..200), `teamSize`
(`solo|small|medium|large`), and optional `phone`/`barAssociationNumber`.
Registration does not collect or accept a lawyer-ID document.

The refresh endpoint prefers the `legalmind_refresh_token` cookie over the JSON
field. The public user omits password, legacy credential path, and token hashes. Access
tokens are JSON values and refresh tokens should remain in the HTTP-only cookie.

Typical typed failures include required/invalid/expired authentication,
unverified or inactive account, email conflict, invalid verification/reset
token, validation error, and rate limiting. Resend and forgot
password deliberately avoid account enumeration.
