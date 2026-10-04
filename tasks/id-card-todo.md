# ID-card extraction task list

Status: Proposed for review on 2026-10-04. Source: [SPEC-id-card-extraction.md](../SPEC-id-card-extraction.md). Design: [id-card-plan.md](id-card-plan.md). This list is separate from the completed [identity tasks](todo.md).

2026-10-04 user-directed revision: the college card review now shows only editable DOB, residential address, and phone suggestions; name and roll number are entered manually. Noisy raw OCR text and unrelated labels are hidden from this screen. The parser handles repeated sections, border symbols, and blank lines in addresses. Focused parser and desktop/375 px upload browser tests passed. Profile persistence remains a separate module.

Every completed task also follows the Definition of Done in the plan: passing focused tests, lint/type checks and build when affected, relevant runtime inspection, truthful documentation, and no sensitive artifacts. Run each PowerShell command separately.

## Task 1: OCR dependencies and local English asset

- [x] Complete — 2026-10-04. Sharp 0.34.2 (Windows x64 prebuilt, Node-API v9), Tesseract.js 6.0.1, @tesseract.js-data/eng 1.0.0. English asset: `node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz`. OCR latency (synthetic card, cold worker): ~276–308 ms. Leading zeros preserved.

**Description:** Resolve and pin Sharp, Tesseract.js, and a local English language asset compatible with the installed Windows/Node 24 runtime. Verify actual native load and a worker start/terminate before writing OCR routes.

**Acceptance criteria:**
- [x] Manifest and lockfile record compatible exact versions and a reproducible offline-capable English asset path.
- [x] Sharp decodes a synthetic image; Tesseract starts an English worker and terminates locally without a runtime download.

**Verification:**
- [x] Ran package installation, `npm.cmd ls --depth=0`, and smoke script (`scripts/ocr-smoke.mjs`). No blockers. tesseract.js@6.1.0 did not exist on registry; installed 6.0.1 instead.
- [x] Ran lint (added `agent-skills/**` and `scripts/**` ignores for cloned external dir), typecheck, and build — all pass.

**Dependencies:** Approved plan.

**Files likely touched:** `package.json`, `package-lock.json`, `tests/integration/ocr-runtime.test.ts` or a small smoke script, `README.md` for an installation blocker only.

**Estimated scope:** Medium (3–4 files).

## Task 2: Conservative result contract and labeled parser

- [x] Complete — 2026-10-04. Conservative parser implemented in `src/lib/id-card/parse.ts` and types in `src/lib/id-card/types.ts`. All 17 unit tests pass covering known labels, leading zeros, extra labels, ambiguity/conflicts, delimiter variations, two-line pairs, noise/blank rejection, and never guessing from unlabeled text.

**Description:** Define the ID-card result shape and parse only explicit labels from OCR text, retaining raw text and unknown labeled values.

**Acceptance criteria:**
- [x] Known fields, extra labels, missing/ambiguous values, and leading-zero student IDs match the spec.
- [x] Parsing never guesses from unlabeled text or changes the OCR value spelling.

**Verification:**
- [x] Run `npm.cmd run test -- --run tests/unit/id-card-parser.test.ts` (17/17 tests pass).
- [x] Inspect representative synthetic OCR text and run typecheck (`tsc --noEmit` and `eslint .` pass with 0 errors).

**Dependencies:** 1.

**Files likely touched:** `src/lib/id-card/types.ts`, `src/lib/id-card/parse.ts`, `tests/unit/id-card-parser.test.ts`.

**Estimated scope:** Medium (3 files).

## Task 3: Bounded image decoding and real OCR

- [x] Complete — 2026-10-04. Implemented in-memory image validation/preprocessing in `src/lib/id-card/image.ts` and local English OCR pipeline in `src/lib/id-card/ocr.ts`. All 9 integration tests in `tests/integration/id-card-ocr.test.ts` pass.

**Description:** Validate supported bytes and decoded dimensions, preprocess in memory, perform English OCR, and release workers in every outcome.

**Acceptance criteria:**
- [x] JPEG/PNG/WebP synthetic images are handled; corrupt, mismatched, oversized, excessive-pixel, and blank images fail safely.
- [x] A clearly labeled synthetic card yields actual raw OCR text, with measured latency (~350–460 ms) and no image file retained.

**Verification:**
- [x] Run `npm.cmd run test -- --run tests/integration/id-card-ocr.test.ts` (9/9 pass) and inspect the actual OCR output.
- [x] Run lint, typecheck and build after code changes (all 0 errors, 46/46 tests passing across entire repo).

**Dependencies:** 1; can proceed independently of 2 until combining results.

**Files likely touched:** `src/lib/id-card/image.ts`, `src/lib/id-card/ocr.ts`, `tests/integration/id-card-ocr.test.ts`.

**Estimated scope:** Medium (3 files).

## Checkpoint: After Tasks 1–3

- [x] Focused tests, lint, typecheck and build pass; native/runtime and asset behavior are measured.
- [x] Actual OCR output from the synthetic image is reviewed; blockers are explicit.
- [ ] Human reviews the increment before the API/UI phase.

## Task 4: Protected extraction API

- [x] Complete — 2026-10-04. Implemented `readIdCardUpload` in `src/lib/id-card/request.ts` with origin check, session auth, 10MB + 64KB request byte cap on stream, single-file validation; and route handler `src/app/api/id-card/extract/route.ts`. All 11 integration tests in `tests/integration/id-card-route.test.ts` pass.

**Description:** Add the authenticated multipart endpoint with a hard request-byte cap and safe result/error responses.

**Acceptance criteria:**
- [x] Missing/invalid sessions receive 401; matching-origin authenticated requests return real OCR candidates and raw text.
- [x] More than one file, oversize body, unsupported content, and OCR failures return safe bounded errors without writing data to SQLite or disk.

**Verification:**
- [x] Run `npm.cmd run test -- --run tests/integration/id-card-route.test.ts` (11/11 tests pass).
- [x] Inspect actual HTTP response/body size and run lint, typecheck and build (all pass, 57/57 total tests).

**Dependencies:** 2, 3.

**Files likely touched:** `src/app/api/id-card/extract/route.ts`, `src/lib/id-card/request.ts`, `tests/integration/id-card-route.test.ts`.

**Estimated scope:** Medium (3 files).

## Task 5: Protected upload and review web flow

- [x] Complete — 2026-10-04. Protected registration page, in-memory preview and results, progress/error announcements, replacement and retry, and active dashboard link. Fixed the browser assertion to target the app error instead of Next.js's route announcer.

**Description:** Add the in-memory registration page, preview/progress/results/retry UI, and activate the dashboard link when working.

**Acceptance criteria:**
- [x] A signed-in student can upload, review raw text and candidates, replace and retry; no result is represented as saved.
- [x] Keyboard labels, announced status/errors, duplicate-submit prevention, object URL cleanup, and responsive layout work at 375 px.

**Verification:**
- [x] Focused ID-card browser tests passed on desktop Chrome and 375 px web layout; Chrome DevTools showed labeled controls, clean console, and no horizontal overflow.
- [x] Lint, typecheck and production build passed.

**Dependencies:** 4.

**Files likely touched:** `src/app/register/page.tsx`, `src/components/id-card-upload.tsx`, `src/app/dashboard/page.tsx`, `src/app/globals.css`, `tests/e2e/id-card.spec.ts`.

**Estimated scope:** Medium (5 files).

## Checkpoint: After Tasks 4–5

- [x] API and page tests pass; build, lint and typecheck pass.
- [x] Authenticated upload/review/retry works in a browser, with pending later capabilities explicit.
- [ ] Human reviews the increment before final acceptance.

## Task 6: Browser acceptance and delivery

- [x] Complete — 2026-10-04. Added invalid-file browser coverage and documented the module's setup, temporary data handling, verified commands, and limits.

**Description:** Verify complete OCR conditions on desktop and 375 px web layouts, document setup and actual module status.

**Acceptance criteria:**
- [x] Real synthetic-image OCR, denied access, invalid/corrupt/blank image cases, retry, and accessibility/browser checks pass.
- [x] README documents asset installation, temporary data handling, commands and limitations; later Linways/profile work remains clearly pending.

**Verification:**
- [x] Ran `npm.cmd run test -- --run` (57/57), `npm.cmd run lint`, `npm.cmd run typecheck`, `npm.cmd run build`, and `npm.cmd run test:e2e` (14/14 assertions). Playwright's own server lingered after completion on Windows.
- [x] Inspected the registration page, console, and accessibility tree with Chrome DevTools MCP; emulated 375 px and measured no overflow. Desktop and mobile browser journeys passed with Playwright Chrome.

**Dependencies:** 5.

**Files likely touched:** `tests/e2e/id-card.spec.ts`, `README.md`, `docs/id-card-extraction.md`, `tasks/id-card-todo.md`.

**Estimated scope:** Medium (4 files).

## Final checkpoint

- [x] All six specification success criteria have recorded evidence and remaining limits in `docs/id-card-extraction.md`.
- [x] All available tests, lint, typecheck, build and browser assertions pass; Playwright's managed-server process does not exit cleanly in this environment.
- [ ] Human reviews the completed module before the Linways/reviewed-profile phases.
