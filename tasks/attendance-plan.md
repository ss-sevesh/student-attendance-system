# Attendance prototype implementation plan

Status: Active plan, 2026-10-04. Source: [SPEC-attendance.md](../SPEC-attendance.md). This plan finishes the **local web demo** already started. The identity and ID-card plans remain in their own files; neither is replaced.

## Current baseline

The app already has SQLite attendance tables and encrypted descriptors, protected APIs, an admin timetable page, and a student enrollment/camera page. The server uses a five-minute window after each period start; the initial timetable seeds 09:00 and 09:45 Monday–Friday. Sixty unit/integration tests, lint, typecheck, production build, and two attendance-page browser checks passed. **The core face flow is not verified:** Playwright Chrome cannot reach the jsDelivr model script (`ERR_NETWORK_ACCESS_DENIED`), so there is no proven card-to-camera check-in yet. Browser-generated descriptors are replayable and there is no liveness detection. The prototype must keep that limitation visible.

## Execution order and dependencies

```text
Task 1: local face-model availability ──> Task 3: enrollment journey ──> Task 4: camera check-in
Task 2: backend contract audit ────────> Task 3, Task 4, Task 5: admin timetable
Task 3 + Task 4 + Task 5 ───────────────> Task 6: browser acceptance and handoff
```

Tasks 1 and 2 can run in parallel with separate agents and disjoint files. Task 5 can start after Task 2 and run alongside Tasks 3–4 if its agent owns only admin UI and admin browser tests. Task 6 runs after integration. The root agent owns coordination, resolves cross-task issues, and checks the combined result. A task agent may spawn a subagent for an independent investigation or test fixture when that reduces work; the task owner remains responsible for integration and evidence. Do not assign multiple agents edits to the same file at once.

## Architecture decisions

- Keep this one Next.js website with SQLite; use the existing session to bind enrollment and attendance to the signed-in user.
- Make model files reproducibly available from the app origin if possible. No demo should depend on an unavailable external CDN. If assets cannot be obtained in this environment, the UI must remain honest and Task 1 records the blocker; no fake match is accepted.
- Keep campus time on the server (`Asia/Kolkata` default, configurable). The window is `[start, start + 5 minutes)`: 09:00:00–09:04:59 and 09:45:00–09:49:59.
- Retain the encrypted 128-number reference only after explicit enrollment; do not upload or store the raw ID-card image through attendance. The student's ability to delete the reference remains visible.
- The browser-computed descriptor is only a demonstration. A later production design needs trusted capture/verification, liveness, identity binding, staff corrections, retention policy, and accuracy evaluation. These are documented separately and are not silently claimed by the demo.

## Agent ownership

| Task | Primary owner | Allowed edit area |
|---|---|---|
| 1 | Face-assets agent | `src/lib/attendance/face-client.ts`, local model assets/setup notes |
| 2 | Backend-audit agent | `src/lib/attendance/{service,http}.ts`, `src/lib/db/schema.ts`, attendance API routes and focused tests |
| 3–4 | Student-flow agent | `src/components/attendance-client.tsx`, `src/app/attendance/page.tsx`, student browser tests |
| 5 | Admin-flow agent | `src/components/attendance-admin.tsx`, `src/app/admin/attendance/page.tsx`, admin browser tests |
| 6 | Root/integration agent | README/docs/task status, complete checks, cross-task fixes after file owners finish |

The student-flow agent starts after Task 1 has an asset result and Task 2 fixes its API contract. The admin-flow agent may start after Task 2 and can work in parallel with student flow. The root agent uses the existing agent slots; agents should not spawn subagents unless their work has a separable investigation or verification task.

## Checkpoints

1. **Foundation:** Tasks 1–2 report concrete results; focused tests, lint, and typecheck pass. If model assets remain blocked, stop claiming an operational face check-in and decide whether a different approved asset source is available.
2. **Journeys:** Tasks 3–5 pass focused desktop/375 px browser checks, including failure states and admin access. Root reviews any shared contract changes before Task 6.
3. **Delivery:** Task 6 runs all unit/integration tests, lint, typecheck, production build, and browser suite; updates README and handoff with exact observed results and remaining demo limits.

## Risks and response

| Risk | Response |
|---|---|
| Model weights cannot be downloaded in the sandbox | Try a reproducible local asset path or an explicitly supported source; otherwise keep the feature visibly unavailable and record the blocker. |
| ID-card portrait too small or obscured | Require exactly one detectable face; show a retry message and test with synthetic/consented fixtures. Do not invent a descriptor. |
| Browser descriptor can be forged/replayed | Label this a local demo; do not deploy for real attendance. Production biometric design is a separate gated effort. |
| Camera permission or HTTPS blocks capture | Explain the failure in the UI; verify localhost/HTTPS requirements and browser denial path. |
| Timetable edits affect existing records | Preserve recorded history and prevent deletion of a period with attendance. |

## Deferred production work

Institution-backed identity proofing for enrollment, server-trusted image processing, tested presentation-attack detection, calibrated matching across demographic groups, staff correction audit, data retention/deletion policy, secure deployment, and real-user authorization are outside this local prototype. They require a separate approved production spec before actual attendance decisions.
