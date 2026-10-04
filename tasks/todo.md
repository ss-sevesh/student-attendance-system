# Identity Task List

Status: Tasks 7-9 checkpoint approved by the user on 2026-10-04. Identity Tasks 10-11 implemented and verified; final identity checkpoint awaits review.

## Execution status

Tasks 10-11 final identity verification (2026-10-04):
- All 17 Vitest tests pass; lint, typecheck and production build pass. Playwright reports 3/3 desktop and 3/3 at a 375 px phone-sized web viewport using installed Google Chrome. The combined `npm.cmd run test:e2e` command exited successfully with 6/6 after reusing the already-running dedicated test server.
- Browser tests cover signup, duplicate feedback, logout and revocation, login, forged and expired sessions, keyboard focus, pending state and horizontal overflow. Chrome DevTools MCP inspected the live 375 px signup accessibility tree, console and document width: labeled fields, no console messages, no overflow.
- Bundled Chromium download stalled under network restrictions. The Playwright server's Windows shutdown lingered when it started the server itself; when a dedicated test server was already running, all Playwright commands exited cleanly. The runner uses installed Chrome's Chromium engine. These limits are documented in README.
- README and `docs/identity-provider.md` now document actual commands, SQLite/cookie contracts, module scope, migration boundaries and verification of the ten identity success criteria.

Tasks 7-9 checkpoint verification (2026-10-04):
- Signup, login and logout routes and pages are implemented. Concurrent canonical signup duplicates return one 201 and one 409; login returns a fresh cookie and the same 401 error for unknown email and wrong password; logout revokes the token and clears the cookie.
- All 17 Vitest tests pass. Lint, typecheck and production build pass. Each test file receives its own temporary SQLite path to prevent concurrent test files from sharing a database.
- Chrome DevTools MCP completed signup, duplicate feedback, logout, denied dashboard revisit, wrong-password feedback and correct login in the production app. At 375 px and 1280 px, the dashboard had no horizontal overflow and the console was clear. Mobile screenshot and accessibility snapshots were inspected.
- Browser testing found and fixed a Next.js internal-host origin mismatch and a live `NextRequest` cookie parsing failure. Both paths were retested in the browser.
- Playwright acceptance tests, expired/forged browser sessions and the final accessibility sweep are reserved for Task 10.

Tasks 4-6 checkpoint verification (2026-10-04):
- SQLite uses the built-in `node:sqlite` driver in Node 24.19.0. Installing the proposed `better-sqlite3` failed with registry `EACCES`; the built-in driver passed real-file persistence, transaction, foreign-key and expiry tests.
- Nine Vitest tests pass. Lint, typecheck and production build pass. Tests reject opening the development database. Password hashing uses asynchronous scrypt with per-password random salt; sessions store token digests and expose only public user fields.
- Chrome DevTools MCP loaded the production homepage at mobile width, inspected its accessibility tree and screenshot, and found no console messages. Account UI is scheduled for Tasks 7-9.
- Vitest emits a future config-loader compatibility warning; tests pass. The Playwright Chromium installation remains pending.
- The workspace has no `.git` directory, so no commits can be recorded.

Foundation checkpoint verification:
- Isolated installed Chrome rendered the production homepage at 1280 px and 375 px with HTTP 200, no overflow and no console errors/warnings. Both screenshots inspected.
- Added app icon after reproducing a missing-resource console error. Set explicit Next.js roots to exclude the unrelated home-directory lockfile. Rebuilt and reran lint/typecheck successfully.
- Bundled Chromium installation did not finish in the agent environment; default Playwright browser installation remains open. Installed Chrome provided the actual browser verification.
- Test database enforcement requires the storage adapter in Task 4; synthetic account fixtures require the account flow. These cannot be claimed verified by runner configuration alone.
- Foundation is ready for human checkpoint review with those tooling limitations documented.

Update after user installation:
- User audit now confirms five high entries from a single braces 3.0.3 lint dependency chain. Upstream advisory GHSA-vfj7-8cjw-p6xm lists no patched release. Preserve compatible lint tooling; track the unresolved development dependency advisory in README rather than force-downgrading or suppressing audit results.
- Restored eslint-config-next to 16.3.8 after forced audit changed it to incompatible 14.2.35; retained Vitest 4.1.11. Manifest and lockfile are aligned.
- Lint, typecheck and production build pass. Production server responds HTTP 200 with the expected homepage.
- Vitest 4.1.11 and Playwright 1.63.0 launch. Playwright test listing correctly reports zero tests; this is not a passing behavioral suite.
- npm audit endpoint remains inaccessible, so current vulnerability count is unverified. Browser visual inspection and Chromium installation remain pending.
- Historical installation blockers below describe the earlier environment state, not the current dependency state.

- Prepared manifest, ignore rules, project-local npm cache settings, static application shell and runner configurations.
- `npm.cmd install` failed with `EACCES` fetching from registry.npmjs.org under the restricted execution environment. A bounded registry probe failed with the same error.
- No lockfile, installed dependencies, build, typecheck, lint, tests or browser verification yet. Initial exact tooling versions remain candidates until dependency resolution succeeds.
- README was added early to document the setup blocker; Task 11 is still incomplete.
- First checkpoint remains open. Resume with dependency installation, resolve compatibility, then verify Tasks 1–3 before the persistence slice. No credentials are needed at this stage.

Source: [SPEC-identity.md](../SPEC-identity.md). Design: [plan.md](plan.md).

Commands below were exercised during implementation. Earlier installation notes above describe the historical environment state. Every task also follows the Definition of Done in plan.md.

## Task 1: Toolchain manifest

- [x] Complete

**Description:** Define pinned compatible dependencies and dev/build/lint/typecheck scripts without running a scaffold over existing documents.

**Acceptance criteria:**
- [x] Manifest targets installed Node 24 and records resolved versions.
- [x] Secrets, SQLite files, dependencies and build output are ignored.

**Verification:**
- [x] Dependencies were installed by the user after the agent's registry `EACCES`; `npm.cmd ls --depth=0` confirmed the resolved manifest.
- [x] Inspect runtime behavior relevant to this task; record result or blocker.

**Dependencies:** None

**Files likely touched:** `package.json`, `package-lock.json`, `.gitignore`.

**Estimated scope:** Medium (3 files).

## Task 2: Application shell

- [x] Complete

**Description:** Create the minimal Next.js shell and strict TypeScript configuration.

**Acceptance criteria:**
- [x] Root page renders and links to the account routes.
- [x] Production build and typecheck pass.

**Verification:**
- [x] Run: `npm.cmd run build; npm.cmd run typecheck` (execute each command separately in PowerShell).
- [x] Inspect runtime behavior relevant to this task; record result or blocker.

**Dependencies:** 1

**Files likely touched:** `tsconfig.json`, `next-env.d.ts`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`.

**Estimated scope:** Medium (5 files).

## Task 3: Test tooling

- [x] Complete with bundled Chromium installation limitation documented below

**Description:** Configure Vitest, ESLint and Playwright with isolated test database paths and Chromium desktop/mobile projects.

**Acceptance criteria:**
- [x] Unit tests cannot open the development database.
- [x] Browser runner starts a local server with synthetic accounts; all verification scripts are declared.

**Verification:**
- [x] Lint and typecheck pass. Bundled Chromium installation was attempted but stalled; installed Chrome ran the browser suite.
- [x] Inspect runtime behavior relevant to this task; record result or blocker.

**Dependencies:** 2

**Files likely touched:** `package.json`, `package-lock.json`, `vitest.config.ts`, `playwright.config.ts`, `eslint.config.mjs`.

**Estimated scope:** Medium (5 files).

## Checkpoint: After Tasks 1–3

- [x] Available tests pass; build, lint and typecheck pass.
- [x] Available user flow works at runtime; blockers and pending capabilities are explicit.
- [x] Human reviews the increment before the next phase.

## Task 4: Identity persistence boundary

- [x] Complete

**Description:** Define asynchronous domain storage operations and implement only a SQLite adapter; perform the native-driver check before further auth work.

**Acceptance criteria:**
- [x] Unique canonical emails and session-token digests persist through reopen; foreign keys are enforced.
- [x] Provider contract tests cover atomic account/session creation, duplicate insertion, expiry and revocation.

**Verification:**
- [x] Run: `npm.cmd run test -- --run tests/integration/identity-store.test.ts` (execute each command separately in PowerShell).
- [x] Inspect runtime behavior relevant to this task; record result or blocker.

**Dependencies:** 3

**Files likely touched:** `src/lib/auth/contracts.ts`, `src/lib/db/sqlite.ts`, `src/lib/db/schema.ts`, `src/lib/auth/sqlite-store.ts`, `tests/integration/identity-store.test.ts`.

**Estimated scope:** Medium (5 files).

## Task 5: Password validation

- [x] Complete

**Description:** Implement bounded inputs and salted asynchronous scrypt hashing, independent of the storage provider.

**Acceptance criteria:**
- [x] Email normalization and 12–128 character password policy match the spec; passwords are unchanged.
- [x] Different salts produce different hashes; malformed hashes and incorrect passwords fail safely.

**Verification:**
- [x] Run: `npm.cmd run test -- --run tests/unit` (execute each command separately in PowerShell).
- [x] Inspect runtime behavior relevant to this task; record result or blocker.

**Dependencies:** 3

**Files likely touched:** `src/lib/auth/validation.ts`, `src/lib/auth/password.ts`, `tests/unit/validation.test.ts`, `tests/unit/password.test.ts`.

**Estimated scope:** Medium (4 files).

## Task 6: Session service

- [x] Complete

**Description:** Implement local identity service operations behind a provider interface and resolve authenticated users through verified sessions.

**Acceptance criteria:**
- [x] Random tokens are stored only as digests; seven-day expiry and revocation are enforced.
- [x] Two-user tests resolve the correct stable owner and expose only public fields.

**Verification:**
- [x] Run: `npm.cmd run test -- --run tests/integration/session.test.ts tests/unit/cookie-policy.test.ts` (execute each command separately in PowerShell).
- [x] Inspect runtime behavior relevant to this task; record result or blocker.

**Dependencies:** 4, 5

**Files likely touched:** `src/lib/auth/provider.ts`, `src/lib/auth/local-provider.ts`, `src/lib/auth/current-user.ts`, `tests/integration/session.test.ts`, `tests/unit/cookie-policy.test.ts`.

**Estimated scope:** Medium (5 files).

## Checkpoint: After Tasks 4–6

- [x] Available tests pass; build, lint and typecheck pass.
- [x] Available user flow works at runtime; blockers and pending capabilities are explicit.
- [x] Human reviews the increment before the next phase.

## Task 7: Signup flow

- [x] Complete

**Description:** Deliver signup API, accessible form and protected dashboard as one working path using the identity provider.

**Acceptance criteria:**
- [x] Valid signup sets the protected cookie and redirects to the dashboard.
- [x] Duplicate canonical emails including concurrent requests fail safely; dashboard redirects invalid sessions.

**Verification:**
- [x] Run: `npm.cmd run test -- --run tests/integration/signup.test.ts; npm.cmd run build` (execute each command separately in PowerShell).
- [x] Inspect runtime behavior relevant to this task; record result or blocker.

**Dependencies:** 6

**Files likely touched:** `src/app/api/auth/signup/route.ts`, `src/app/signup/page.tsx`, `src/app/dashboard/page.tsx`, `src/lib/auth/http.ts`, `tests/integration/signup.test.ts`.

**Estimated scope:** Medium (5 files).

## Task 8: Login flow

- [x] Complete

**Description:** Add login API and form using the established provider and shared HTTP validation.

**Acceptance criteria:**
- [x] Valid credentials issue a fresh token and reach the dashboard.
- [x] Unknown email and wrong password return the same safe message; foreign-origin requests are rejected.

**Verification:**
- [x] Run: `npm.cmd run test -- --run tests/integration/login.test.ts; npm.cmd run build` (execute each command separately in PowerShell).
- [x] Inspect runtime behavior relevant to this task; record result or blocker.

**Dependencies:** 7

**Files likely touched:** `src/app/api/auth/login/route.ts`, `src/app/login/page.tsx`, `src/lib/auth/local-provider.ts`, `tests/integration/login.test.ts`.

**Estimated scope:** Medium (4 files).

## Task 9: Logout flow

- [x] Complete

**Description:** Deliver logout through the dashboard and revoke the current session.

**Acceptance criteria:**
- [x] Logout clears the cookie and old-token replay fails; repeated logout is safe.
- [x] Dashboard shows truthful pending registration/profile functionality without a dead action.

**Verification:**
- [x] Run: `npm.cmd run test -- --run tests/integration/logout.test.ts; npm.cmd run build` (execute each command separately in PowerShell).
- [x] Inspect runtime behavior relevant to this task; record result or blocker.

**Dependencies:** 8

**Files likely touched:** `src/app/api/auth/logout/route.ts`, `src/app/dashboard/page.tsx`, `src/components/logout-button.tsx`, `tests/integration/logout.test.ts`.

**Estimated scope:** Medium (4 files).

## Checkpoint: After Tasks 7–9

- [x] Available tests pass; build, lint and typecheck pass.
- [x] Available user flow works at runtime; blockers and pending capabilities are explicit.
- [x] Human reviews the increment before the next phase.

## Task 10: Browser acceptance

- [x] Complete

**Description:** Verify the complete account journey and protected access at desktop and mobile widths.

**Acceptance criteria:**
- [x] Signup/logout/login, duplicate feedback and expired/revoked access work in Chromium.
- [x] Keyboard operation, labels, announced errors and pending states work at 375 px; fix discovered issues within task scope.

**Verification:**
- [x] Run: `npm.cmd run test:e2e -- --project=chromium; npm.cmd run test:e2e -- --project=mobile-chromium` (execute each command separately in PowerShell).
- [x] Inspect runtime behavior relevant to this task; record result or blocker.

**Dependencies:** 9

**Files likely touched:** `tests/e2e/identity.spec.ts`, `src/app/signup/page.tsx`, `src/app/login/page.tsx`, `src/app/dashboard/page.tsx`, `src/app/globals.css`.

**Estimated scope:** Medium (5 files).

## Task 11: Delivery documentation

- [x] Complete

**Description:** Document actual setup and identity contracts, then run the full module checks.

**Acceptance criteria:**
- [x] README covers database path, local cookie exception, commands and actual module status.
- [x] Migration notes distinguish database replacement from managed Auth; all ten identity success criteria have recorded verification.

**Verification:**
- [x] Run: `npm.cmd run test -- --run; npm.cmd run lint; npm.cmd run typecheck; npm.cmd run build; npm.cmd run test:e2e` (execute each command separately in PowerShell).
- [x] Inspect runtime behavior relevant to this task; record result or blocker.

**Dependencies:** 10

**Files likely touched:** `README.md`, `docs/identity-provider.md`, `tasks/todo.md`.

**Estimated scope:** Medium (3 files).

## Checkpoint: After Tasks 10–11

- [x] Available tests pass; build, lint and typecheck pass.
- [x] Available user flow works at runtime; blockers and pending capabilities are explicit.
- [x] Human reviews the increment before the next phase.
