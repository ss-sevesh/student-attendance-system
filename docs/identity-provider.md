# Identity provider contract and verification

The application owns stable opaque user IDs. `IdentityStore` in `src/lib/auth/contracts.ts` exposes asynchronous account and session operations; `src/lib/auth/sqlite-store.ts` is the only implemented storage adapter. `IdentityProvider` in `src/lib/auth/provider.ts` owns signup, login, session resolution, and logout. Routes and pages call the provider rather than importing SQLite. `getCurrentUser()` returns only `{ id, email }`; `requireUser()` redirects an unauthenticated page visit to `/login`. Future protected APIs should return 401 and derive ownership from this server-verified ID, never a client-supplied ID.

The SQLite schema is versioned with `PRAGMA user_version`. Users have unique canonical emails. Sessions store a SHA-256 digest of a 32-byte random token, their owner, and millisecond timestamps. A transaction creates the account and first session together. Foreign keys are enabled. Password hashes record the scrypt version, parameters, random salt, and derived hash. The raw token lives only in an HttpOnly cookie; logout revokes its digest. Sessions expire after seven days without renewal.

## Future provider changes

A database-only replacement can implement `IdentityStore` against another database while keeping the current application-owned passwords and sessions. Preserve unique canonical emails, atomic signup/session creation, stable user IDs, token digest lookup, expiry, and revocation. Port the contract tests to the replacement. A Supabase Postgres implementation also needs a verified transaction strategy and, if exposed through a Data API, grants and ownership RLS policies.

Adopting managed Auth is a different migration. It replaces `IdentityProvider` behavior, including signup confirmation, cookies, refresh, expiry, logout, and current-user resolution. Existing scrypt hashes and local sessions cannot be assumed importable. Before migrating, approve a migration spec, back up local data, map managed IDs to stable application IDs, verify password transfer or reset options, test cross-account denial, and rehearse rollback. No Supabase integration or credentials are included in the identity module.

## Identity success criteria

| # | Evidence |
|---|---|
| 1 | Signup integration and browser journey verify one account, salted hash storage, cookie, and dashboard access. |
| 2 | Store and signup integration tests cover canonical duplicate insertion and concurrent signup; browser test checks visible feedback. |
| 3 | Login integration and browser tests verify a fresh session and generic unknown-email/wrong-password response. |
| 4 | Session tests cover expiry and revocation; browser tests reject missing, forged, expired, and logged-out dashboard access. |
| 5 | Logout integration and browser tests verify cookie clearing, old-token rejection, and repeated logout. |
| 6 | Real-file store test reopens SQLite and resolves an unexpired session; the browser session also survived a local server restart during manual verification. |
| 7 | Two-user session test verifies stable owner and public-only fields; signup response test checks its exact user keys. |
| 8 | Desktop and 375 px browser tests check labels, keyboard focus, announced errors, pending disabled button, and no horizontal overflow. Chrome DevTools accessibility snapshots and screenshots were inspected. |
| 9 | Browser dashboard checks the disabled Register Student control and truthful latest-profile empty state. |
| 10 | Vitest, ESLint, TypeScript, and production build passed; desktop and 375 px Playwright assertions passed using installed Chrome. The runner's Windows server shutdown may linger after reporting results. |

The full registration journey remains pending in the OCR, Linways, and reviewed-profile modules. Their tests must check ownership isolation using two accounts and must not persist uploaded images or portal credentials.
