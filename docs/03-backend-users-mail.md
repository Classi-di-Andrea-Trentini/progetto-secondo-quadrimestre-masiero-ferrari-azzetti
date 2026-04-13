# Backend — Users and Mail Modules

## Users module

Path: `server/src/users/`

All routes are under `/users` and are protected by `JwtAuthGuard` except the two confirmation endpoints that are reached by clicking a link in an email.

### users.service.ts

The service handles all account management operations that go beyond the basic login/register flow.

**updateProfile(userId, dto)** — patches the user record with only the fields present in the DTO. The update data object is built incrementally so that undefined fields are never passed to Prisma (which would overwrite them with null). The `birthDate` field is converted from a date string to a JavaScript `Date`. Returns the updated user using the `USER_SELECT` constant, which is a shared projection that lists all safe-to-expose fields and excludes `passwordHash`.

**requestEmailChange(userId, dto)** — changing an email is a two-step process because the new address needs to be confirmed before it takes effect. This method verifies the current password first, then checks that the new email is not already taken by another account. It deletes any previous pending verification for this user (so you can only have one pending email change at a time), then creates a JWT signed with `JWT_SECRET` that encodes the userId, the new email, and a `purpose: 'email-change'` claim. This JWT is stored in the `email_verifications` table and also embedded in a confirmation link sent to the new address. The link points to `GET /users/confirm-email/:token`.

**confirmEmailChange(token)** — the endpoint hit when the user clicks the confirmation link. Verifies the JWT signature and the `purpose` claim, checks the verification record has not been used and has not expired, verifies the new email is still available, updates the user's email and sets `emailVerifiedAt`, marks the verification record as used, and sends an alert to the old email address.

**sendVerificationEmail(userId)** — generates a similar JWT with `purpose: 'email-verify'`, stores it, and emails a link to the user's current address. The link points to `GET /users/verify-email/:token`. Multiple calls invalidate previous tokens by deleting them first.

**confirmVerification(token)** — verifies the JWT and the verification record, then sets `emailVerifiedAt` on the user.

**changePassword(userId, currentSessionId, dto)** — verifies the current password before hashing the new one. After updating the hash, it deletes all sessions for that user except the current one. This logs out all other devices. A `passwordChangedAlert` email is sent as fire-and-forget.

### DTOs

`update-profile.dto.ts` — all fields are optional. `fullName` requires minLength 2 if provided. `birthDate` is a date string. `newsletterOptIn` is boolean.

`change-email.dto.ts` — `newEmail` (valid email, max 255), `currentPassword` (required).

`change-password.dto.ts` — `currentPassword`, `newPassword` (min 8, max 72).

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| PATCH | /users/me | Update profile fields |
| POST | /users/me/change-email | Request email change (sends confirmation link) |
| POST | /users/me/send-verification | Resend email verification link |
| POST | /users/me/change-password | Change password, invalidate other sessions |
| GET | /users/verify-email/:token | Confirm email verification (public) |
| GET | /users/confirm-email/:token | Confirm email change (public) |

---

## Mail module

Path: `server/src/mail/`

`MailModule` is marked `@Global()` and exports `MailService`, so any other module can inject `MailService` without importing `MailModule`.

### mail.service.ts

Sends emails via the Resend API using the native `fetch` function (no SDK). The `send()` private method handles the actual HTTP call. In development mode (when `NODE_ENV` is not `'production'`), it logs the full email content to the console regardless of whether an API key is configured. If the API key is missing, it logs a warning and returns without sending. This means the app works in development with no email configuration — you can read the email bodies from the Docker logs.

All public methods (`sendWelcome`, `sendEmailVerification`, `sendEmailChangeConfirmation`, `sendEmailChangedAlert`, `sendPasswordChangedAlert`, `sendNewsletterConfirmation`) are thin wrappers that call `send()` with the appropriate subject and HTML body from `templates.ts`.

### mail/templates.ts

Contains one function per email type. Each function takes the required data as parameters and returns an HTML string. The templates are plain HTML strings, not a template engine. They follow a consistent structure: dark header with the brand name, a body area with the message, and a footer.

Emails currently implemented:
- Welcome email sent after registration
- Email verification link
- Email change confirmation link (sent to the new address)
- Alert sent to old address when email is changed
- Alert sent when password is changed
- Newsletter confirmation

### Using MailService in other modules

Because `MailModule` is global, you just inject it:

```typescript
constructor(private readonly mail: MailService) {}
```

All calls in the codebase are fire-and-forget with `.catch(() => {})`. A mail failure is never allowed to break the operation that triggered it.
