# Backend — Auth Module

Path: `server/src/auth/`

## How authentication works

The system uses JWT tokens stored in an HttpOnly cookie, combined with a server-side session record in the database. The cookie approach means JavaScript on the page cannot read the token at all, which eliminates a whole class of XSS-based token theft.

When a user logs in, the server creates a row in the `sessions` table and issues a JWT whose payload contains three claims: `sub` (the user's UUID), `sid` (the session's UUID), and `role`. Every subsequent request sends the cookie automatically. The JWT strategy validates the signature, then does a second check against the database to confirm the session still exists and has not expired. This double check means you can invalidate a session immediately by deleting the row, without waiting for the JWT to expire.

## auth.service.ts

**register(dto)** — checks for duplicate email (normalised to lowercase), hashes the password with bcrypt at cost factor 12, creates the user record, and fires off a welcome email as fire-and-forget (errors are swallowed so a mail failure does not break registration). Returns only safe user fields, never the password hash.

**login(dto, ipAddress, userAgent)** — looks up the user by lowercase email, checks `isActive` and `deletedAt` before comparing passwords. The error message is intentionally generic ("Credenziali non valide") regardless of whether the email exists or the password is wrong, to avoid user enumeration. On success it generates a random 32-byte token (`randomBytes`), hashes it with SHA-256, and stores the hash in the `sessions` table. The raw token is never stored. It also updates `lastLoginAt` on the user. Returns the session ID, user data, and role — the controller uses these to sign the JWT.

**validateSession(userId, sessionId)** — called on every authenticated request by the JWT strategy. Loads the session by ID, then checks: does it belong to this user, has it expired, is the user still active and not deleted. Returns the user object if all checks pass, or null.

**logout(sessionId)** — deletes the session row. The cookie is cleared by the controller. Uses `.catch(() => {})` to handle the edge case where the session was already deleted.

**getProfile(userId)** — used by `GET /auth/me`. Returns all user fields including the default address. Called after authentication is confirmed, so no additional auth check is needed.

## auth.controller.ts

**POST /auth/register** — throttled to 5 requests per IP per 15 minutes to slow down automated registrations.

**POST /auth/login** — throttled to 10 requests per IP per 15 minutes. Extracts the real client IP from the `X-Forwarded-For` header (relevant when running behind a proxy). Calls `authService.login()`, then signs a JWT with `JwtService` and sets it as the `access_token` cookie. The cookie options are: `httpOnly: true`, `secure: true` in production, `sameSite: strict`, 7-day `maxAge`.

**POST /auth/logout** — protected by `JwtAuthGuard`. Reads the existing cookie, decodes it to get the `sid`, calls `authService.logout(sid)`, then clears the cookie by setting `maxAge: 0`.

**GET /auth/me** — protected by `JwtAuthGuard`. Returns `req.user`, which is the user object attached by the JWT strategy after session validation.

## jwt.strategy.ts

Extends `PassportStrategy(Strategy)` from `passport-jwt`. Configured to extract the JWT from the `access_token` cookie (not from the Authorization header). The `validate()` method receives the decoded payload, calls `validateSession()`, and attaches `sessionId` to the returned user object so that controllers can identify the current session (used in `changePassword` to invalidate all other sessions).

## Token lifetime

JWT: 7 days (`expiresIn` set on `JwtModule` in `auth.module.ts`)
Session row: also 7 days, set as `expiresAt` on creation
Cookie `maxAge`: also 7 days

All three values are kept in sync. If the JWT is valid but the session row is gone (manual invalidation), `validateSession` returns null and the request gets a 401.

## DTOs

`register.dto.ts` — `fullName` (string, 2–255 chars), `email` (valid email format), `password` (8–72 chars, 72 is bcrypt's max).

`login.dto.ts` — `email`, `password` as plain required strings. No length validation on login since that would leak information about password constraints.
