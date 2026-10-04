# Spec: Identity and Dashboard Foundation

Module id: `identity`

Status: Accepted for planning through the user's request to proceed to planning on 2026-10-04. Implements the identity boundary in [CAPABILITY-MAP.md](CAPABILITY-MAP.md); source scope is [PLAN.md](PLAN.md). Technical plan remains subject to review.

## Objective

Let a student create an application account, sign in, access their protected dashboard, and sign out. Provide the user/session ownership contract required by OCR, Linways extraction, and reviewed-profile modules.

Application credentials and Linways credentials are separate. This module never requests portal credentials.

The dashboard presents a prominent Register Student action and an empty-state region for the latest reviewed profile. The registration destination and saved-profile rendering become functional in their owning modules. Identity verification must not imply those later capabilities are complete.

## Proposed assumptions

- Signup signs the user in and redirects to `/dashboard`.
- Email is trimmed and lowercased for account lookup and uniqueness. Passwords are never trimmed or normalized.
- Proposed password policy: 12–128 characters, allowing spaces and Unicode without composition rules.
- Sessions expire after seven days with no automatic renewal or Remember Me option. Logout revokes the current session; other devices remain signed in.
- Email verification, password reset, social login, account deletion, and administration are outside the prototype scope.
- The application runs locally with SQLite. Production deployment and distributed abuse prevention require a separate scope decision.
- The user may later swap to Supabase. Isolate persistence behind an asynchronous domain store and auth behavior behind an identity provider; routes and UI must not import SQLite directly. Implement SQLite only now. A future database-only swap and Supabase Auth adoption are distinct migrations, requiring verified hash/session compatibility and stable user-ID mapping.

## Tech Stack

- Next.js App Router, TypeScript with strict checking, React, and the Node.js server runtime.
- One SQLite database shared by the application. Identity owns user and session tables; subsequent modules own their tables.
- Proposed persistence driver: `better-sqlite3`; password hashing: Node.js `crypto.scrypt` with a random per-password salt and recorded parameters.
- Proposed verification tools: Vitest for unit/integration tests, Playwright for browser tests, ESLint, and TypeScript.
- Exact supported versions, hashing parameters, and native-driver compatibility must be checked against official documentation and the installed Node.js version during technical planning, then pinned in the manifest and lockfile. No package manifest or runnable application currently exists.

## Commands

The following are proposed scripts to create during implementation, run from the repository root in PowerShell. They are not available yet.

```powershell
npm.cmd install
npm.cmd run dev -- --hostname 127.0.0.1
npm.cmd run build
npm.cmd run start -- --hostname 127.0.0.1
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test -- --run
npx.cmd playwright install chromium
npm.cmd run test:e2e -- --project=chromium
```

Tests use a separate temporary SQLite database and synthetic accounts. Development and test database locations must be explicit; neither is committed.

## Project Structure

```text
src/app/signup/page.tsx         Signup form
src/app/login/page.tsx          Login form
src/app/dashboard/page.tsx      Protected dashboard
src/app/api/auth/*/route.ts     Signup, login, logout handlers
src/components/                Accessible shared form/UI components
src/lib/auth/                  Validation, hashing, session and access helpers
src/lib/db/                    SQLite connection and versioned schema setup
tests/unit/                    Validation and password/session logic
tests/integration/             Real SQLite and authentication handler checks
tests/e2e/                     Browser account and dashboard flows
data/                          Ignored local SQLite files
README.md                      Setup, configuration, commands, scope/status
```

Paths are proposed conventions, not existing files. Keep database access, hashing, and session secrets in server-only modules.

## Data and Boundary Contracts

User records contain an opaque stable user ID, canonical unique email, salted password hash with parameters, and creation time. Session records contain a unique digest of a cryptographically random token, owning user ID, creation time, and expiry time. Store no plaintext password or raw session token in SQLite.

The cookie contains the opaque raw session token. Use HttpOnly, SameSite=Lax, Path=/, and an expiry aligned with the session. Set Secure under HTTPS; local HTTP development needs an explicitly documented exception. Rotate to a new session on successful signup/login.

Server-only access helpers expose:

```typescript
type AuthenticatedUser = Readonly<{
  id: string;
  email: string;
}>;

// Contract example; not implementation.
async function getCurrentUser(): Promise<AuthenticatedUser | null>;
async function requireUser(): Promise<AuthenticatedUser>;
```

Missing, expired, invalid, or revoked sessions resolve to unauthenticated. Protected pages redirect to `/login`; protected APIs return HTTP 401 with a safe error. Downstream modules obtain ownership from the server session, never from a client-supplied user ID. Their database queries must constrain access by that user ID.

| Endpoint | Input | Success | Expected failure |
|---|---|---|---|
| `POST /api/auth/signup` | JSON email, password | 201; session cookie; public user fields | 400 validation; 409 duplicate email |
| `POST /api/auth/login` | JSON email, password | 200; new session cookie; public user fields | 400 validation; 401 generic invalid credentials |
| `POST /api/auth/logout` | No credentials | 204; revoke current token and clear cookie; idempotent | 403 rejected request origin |

Errors return `{ error: { code, message } }` without stack traces, hashes, tokens, or passwords. Enforce same-origin mutation requests; document local host configuration. Validate JSON types and bounded request sizes. Prevent duplicate email creation with a database uniqueness constraint, including concurrent signup attempts.

## Code Style

Use descriptive camelCase functions/variables, PascalCase components/types, explicit boundary types, and consistent formatter output. Keep UI handlers small; perform all validation and authorization again on the server. Prefer early returns for expected failures.

```typescript
type LoginInput = { email: string; password: string };

function canonicalizeEmail(email: LoginInput['email']): string {
  return email.trim().toLowerCase();
}
```

Do not return database records directly. Display actionable validation messages; invalid login uses the same message whether the email is absent or the password is wrong.

## Testing Strategy

- Unit tests cover email normalization, malformed inputs, password limits, successful/failed hash verification, and session expiry boundaries.
- Integration tests use real temporary SQLite storage to verify unique accounts, concurrent duplicate handling, token digests, revocation, and unauthorized access. Verify persistence after reopening the database.
- Browser tests cover signup → dashboard → logout → login, duplicate email feedback, generic invalid-login feedback, expired-session redirect, keyboard operation, and desktop/mobile layouts.
- Two synthetic accounts verify that helpers resolve the correct owner; profile-level isolation is subsequently tested by reviewed-profile.
- All listed security and user-flow conditions need passing assertions. No arbitrary percentage coverage target; critical ownership, revocation, and expiry branches must be exercised.
- Run tests, lint, typecheck, and build before calling the module complete. Record any environment blocker explicitly.

## Boundaries

- **Always:** Hash passwords; use parameterized SQL; validate on the server; enforce protected-route access; exclude secrets and databases from version control; test auth/session behavior; document actual runnable commands.
- **Ask first:** Changes outside this approved module, production deployment, additional account flows, or changes to approved session/password behavior. Dependencies and schema described here become authorized when the specification and subsequent technical plan are approved.
- **Never:** Store/log plaintext passwords or tokens; put portal credentials in this module; accept client ownership claims; bypass authorization for tests; delete failing tests to obtain a passing result; claim later registration modules are complete.

## Success Criteria

1. Valid signup creates exactly one account with a salted password hash and opens the protected dashboard.
2. Canonically duplicate emails produce visible duplicate feedback without creating another account, including concurrent requests.
3. Valid login creates a fresh database-backed session; wrong password and unknown email receive generic invalid-credentials feedback.
4. Dashboard access requires a live session; missing, forged, expired, and revoked tokens cannot grant access.
5. Logout clears the cookie and invalidates reuse of the old token. Repeated logout is safe.
6. Restarting the application retains accounts and unexpired sessions through SQLite persistence.
7. Identity helpers return the session owner; API responses expose no password hash, session token, or private database fields.
8. Forms have labels, usable keyboard focus, error announcements, pending states, and prevention of duplicate submission at desktop and 375 px mobile width.
9. Dashboard includes the Register Student action and truthful profile empty state; later-module functionality is clearly pending until implemented.
10. Required tests, lint, typecheck, and production build pass, with README setup verified against actual commands.

## Open Questions for Review

- Are the proposed 12-character password minimum, seven-day session lifetime, and automatic signin after signup acceptable?
- Technical versions and hashing parameters remain planning decisions requiring documented compatibility verification.

## Review Gate

Approve or revise this specification before writing the identity technical plan. No application code is included in this document. The subsequent plan is saved to `tasks/plan.md` and reviewed before task execution.
