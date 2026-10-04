# Attendance prototype task list

Status: Active, 2026-10-04. Source: [SPEC-attendance.md](../SPEC-attendance.md). Execution: [attendance-plan.md](attendance-plan.md). Existing code is a partial baseline, not evidence that these tasks are complete. Task agents own the listed files; root integrates and verifies.

## Task 1 — Make face models available locally (face-assets agent)

Status: Complete for model availability and detection, 2026-10-04. The pinned script and weights are installed under `public/face-api/`; actual browser detection passed on desktop and 375 px.

**Subtasks**
- [x] Identify a legitimate source, version, license, and exact script/weight files used by the current browser code.
- [x] Serve the script and models from the app origin or establish another reproducible source that this browser can actually reach; keep model loading errors actionable.
- [x] Test loading and one-face/no-face detection in a real browser, without using a mock as proof of model operation.

**Acceptance evidence:** Playwright browser network showed HTTP 200 for the script, three manifests, and four shards, with zero console warnings/errors. A blank image produced “No face found”; a CC BY 3.0 photographic portrait generated a finite 128-number descriptor. The repeatable real-model test passed on desktop and 375 px. Chrome DevTools MCP itself could not attach because its dedicated profile was locked, so network and console evidence came from Playwright MCP.

**Verify:** Focused browser smoke, network requests and console via Chrome DevTools MCP, `npm.cmd run lint`, `npm.cmd run typecheck`. **Depends on:** none. **Files:** `src/lib/attendance/face-client.ts`, `public/face-api/` (if obtained), setup notes. **Size:** medium.

## Task 2 — Audit attendance storage and API contract (backend-audit agent)

Status: Complete, 2026-10-04. Seven focused tests, lint, and typecheck pass. Input bounds, key validation, migration preservation, and duplicate race handling reviewed.

**Subtasks**
- [x] Check migration from identity SQLite v1 to v2, five-minute boundaries, timezone, record uniqueness, period deletion, and enrollment key handling.
- [x] Check auth/admin ownership, input size/type limits, error shape, and duplicate submissions; fix observed defects only.
- [x] Add focused tests for fixes and run the relevant suite.

**Acceptance:** The server cannot record outside an open period, for another user, or twice for the same user/date/period; bad inputs and unauthorized access fail safely; existing attendance survives timetable editing.

**Verify:** `npm.cmd run test -- --run tests/integration/attendance.test.ts`, new focused route tests if needed, lint and typecheck. **Depends on:** none. **Files:** attendance service/http/routes, `src/lib/db/schema.ts`, focused tests. **Size:** medium; split fixes into small commits/steps if scope grows.

## Checkpoint A — Foundation

- [x] Task 1 was initially blocked by network access; the pinned assets were downloaded after network approval, and real model-load evidence is recorded above.
- [x] Task 2 focused tests, lint, and typecheck pass.
- [x] Root reconciled the attendance API changes; student and admin browser checks completed against them.

## Task 3 — Finish explicit portrait enrollment (student-flow agent)

Status: Real photographic portrait enrollment and synthetic-fixture journey complete, 2026-10-04. Physical ID-card portrait and ownership remain unverified.

**Subtasks**
- [x] Use the same-origin model path, validate supported image type/size, and show progress/error states. One-face behavior passed with both the injected fixture and an actual model on a photographic portrait.
- [x] Verify consent, current-session enrollment API, replacement, and deletion with a synthetic descriptor.
- [x] Test the fixture browser flow at desktop and 375 px with non-sensitive synthetic data.

**Acceptance:** A successful single-face card enrollment persists only the protected descriptor; blank/multi-face/unsupported input does not enroll; deleting the reference removes enrollment. No raw image is stored.

**Verify:** Focused browser and API tests, responsive/console inspection, lint/typecheck. **Depends on:** Tasks 1–2. **Files:** `attendance-client.tsx`, student attendance page, student browser tests. **Size:** medium.

## Task 4 — Finish camera check-in (student-flow agent after Task 3)

Status: UI fixture checks and actual-model matching from a controlled photographic video stream complete, 2026-10-04. A live-person hardware-camera match remains unverified.

**Subtasks**
- [x] Start/stop camera with visible preview and track cleanup; handle permission denied, insecure origin, and missing camera in the UI.
- [x] Check-in outcomes and today’s records exercised with synthetic fixture; actual model matched a controlled photographic video stream. Live-person matching remains pending.
- [x] Two controlled period decisions, keyboard, and 375 px layout exercised with synthetic fixture.

**Acceptance:** A matched live camera demo records one attendance entry per period; duplicate or failed attempts do not create another. The UI continues to warn that it lacks liveness and can be replayed.

**Verify:** Focused browser tests plus service tests; Chrome DevTools console/network/DOM. **Depends on:** Tasks 1–3. **Files:** `attendance-client.tsx`, student browser tests, minimal supporting test fixture. **Size:** medium.

## Task 5 — Verify admin timetable (admin-flow agent)

Status: Complete within local browser fixture scope, 2026-10-04. Desktop and 375 px assertions passed; Playwright webServer teardown lingered, so the focused command did not exit cleanly.

**Subtasks**
- [x] Configure a demo admin account through `ADMIN_EMAIL` and verify the editor adds/removes weekly periods.
- [x] Verify a non-admin cannot open the editor or mutate timetable APIs.
- [x] Check that removing a period with recorded attendance is refused and records remain intact.

**Acceptance:** Admin-created 09:00 and 09:45 periods appear on the student page and each has its own five-minute window; non-admin attempts fail; existing records are retained.

**Verify:** Browser/API tests on desktop and 375 px, lint/typecheck. **Depends on:** Task 2. **Files:** admin component/page and admin browser tests. **Size:** medium.

## Checkpoint B — Complete demo journeys

- [ ] A physical card and live-person camera check-in pass within an open five-minute period, then a second period. Model detection, controlled video matching, and admin paths already pass browser checks.
- [x] Root reviewed integrated changes and ran the combined unit/integration, lint, typecheck, and build checks.

## Task 6 — Final acceptance and handoff (root/integration agent)

**Subtasks**
- [x] Run `npm.cmd run test -- --run`, `npm.cmd run lint`, `npm.cmd run typecheck`, and `npm.cmd run build` (64 tests pass). The full Playwright suite exited 0 with 26 passed and 2 admin tests skipped; the separate admin config exited 0 with 2 passed.
- [x] Inspect desktop and 375 px flows in a real browser; record actual model/network/camera findings. Playwright MCP supplied network/console inspection because Chrome DevTools MCP's profile was locked. One video input was enumerated, but the manual hardware-camera request remained pending permission; controlled video matching passed in the repeatable test.
- [x] Update README, spec status, and handoff with exact passes, blockers, setup commands, and prototype-only limitations.

**Acceptance:** The local demo is reproducible and its verified behavior is stated accurately. Unfinished face or camera behavior is marked pending, never presented as complete.

**Verify:** Complete command outputs and browser evidence. **Depends on:** Tasks 3–5 and checkpoints. **Files:** README, docs/handoff, this task list, cross-task fixes only after owner coordination. **Size:** medium.

## Deferred production track

## Anytime selfie demo

- [x] Separate authenticated demo page and APIs, encrypted reference, saved Present, reset/removal, schema v3 migration.
- [x] Actual face model and actual backend browser journey passed on desktop and 375 px; 75 unit/integration tests passed, lint/typecheck/build passed.
- [ ] User tests their own reference selfie and physical webcam. Photographic video verification does not establish liveness.

## Production follow-up

- [ ] Create a separate production spec for trusted biometric processing, liveness, ID ownership, staff correction/audit, retention, accessibility alternatives, and institutional approval. This is **not** required to finish the local demo and no current prototype result should be used for real attendance decisions.
