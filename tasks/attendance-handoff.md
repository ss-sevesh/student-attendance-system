# Project handoff — 2026-10-04

## Start here

This is a **responsive Next.js website**, not a native mobile app. Read `README.md`, `SPEC-attendance.md`, `tasks/attendance-plan.md`, and `tasks/attendance-todo.md`. The task list is the current source of truth. The ID-card OCR work is tracked separately in `tasks/id-card-todo.md`. Linways integration and reviewed-profile persistence remain separate future modules.

The user approved the foundation checkpoint, asked for a clear spec/plan/task breakdown, explicitly authorized agents and nested subagents, and asked for a professional GitHub repository under `ss-sevesh`. Four agents were used: face assets, attendance backend audit, student flow, and admin flow. All four have finished; do not assume an agent is still running in a new session. The `agent-skills/references/orchestration-patterns.md` file is an **existing reference guide that was read**, not a file created for this project. `tasks/attendance-plan.md` and `tasks/attendance-todo.md` were created for this project using the planning and spec skills.

## Verified state

- Identity and temporary ID-card OCR are implemented; see their own task lists for exact status. OCR does not save a reviewed profile.
- Attendance backend has SQLite v2 migration, weekly periods, server-enforced five-minute windows in `Asia/Kolkata` by default, encrypted per-user face descriptors, and unique per-student/date/period records. The backend agent fixed malformed-input responses, request-size limits, encryption-key validation, duplicate races, and migration preservation.
- Admin timetable UI adds/removes periods and protects access by `ADMIN_EMAIL`. Its browser checks covered 09:00/09:45 periods, student visibility, non-admin denial, refusal to delete a period with a record, and 375 px layout.
- Student UI covers explicit consent, image type/size validation, enrollment/replacement/deletion feedback, camera errors, cancellation and track cleanup, and period check-in outcomes. The six original student assertions passed on desktop and 375 px with an injected synthetic face fixture.
- The pinned face-api.js 0.22.2 script, three manifests, and four shards were downloaded under `public/face-api/`. In a real browser, every asset returned HTTP 200 with no console warnings/errors. A blank image produced “No face found”; an attributed photographic portrait produced a finite 128-number descriptor and enrolled. A separate actual-model test matched the same portrait from a controlled video stream. Both real-model tests passed on desktop and 375 px. That video stream is a replay, not a live person.
- `npm.cmd run test -- --run` passed **64 tests in 13 files**. `npm.cmd run lint`, `npm.cmd run typecheck`, and `npm.cmd run build` passed with the downloaded assets present.
- Playwright's Windows webServer teardown hung after passing assertions. `scripts/run-e2e.mjs` now starts and closes Next directly. The full standard browser suite exited 0: **26 passed, 2 admin tests intentionally skipped**. The separate admin config exited 0: **2 passed** (desktop and 375 px).

## Pending acceptance

Physical ID-card portrait extraction, card ownership, and a live-person hardware-camera match during an actual open period remain unverified. Playwright MCP enumerated one video input, but a manual hardware-camera request remained pending permission and was cancelled. The repeatable video-stream test uses a photographic replay and a mocked open-period/check-in response; it verifies the actual model's video path, not a genuine attendance decision. The backend period/window and matching contract has separate unit/integration tests. Chrome DevTools MCP could not attach because its dedicated profile was locked by another browser instance; real browser network/console evidence came from Playwright MCP instead.

The attendance prototype is unsuitable for real attendance decisions: browser-generated descriptors can be replayed, there is no validated liveness check, and ID-card ownership is not independently established. Production safeguards are a deferred spec, not an accepted part of this local demo.

## Git

The user will handle GitHub separately. Keep local commits for tracking. `.gitignore` excludes dependencies, build output, local DB, environment files, test artifacts, and the cloned `agent-skills/` folder. `.gitattributes` keeps downloaded model shards byte-for-byte in Git. This repository was initialized by the sandbox account, so Git commands from the normal account may need a per-command `-c safe.directory=C:/Users/11SEV/Desktop/student_info` option. Check `git status` before any further commit; never include `.env.local`, `data/`, or `agent-skills/`.

## Useful commands

```powershell
npm.cmd install
npm.cmd run setup:face-models
npm.cmd run dev -- --hostname 127.0.0.1
npm.cmd run test -- --run
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run build
```

Set `ADMIN_EMAIL` in `.env.local` to an application account for the timetable editor. The face-asset setup needs an internet-connected machine. See `README.md` for app and test-server setup.

## Next-session priority

### Anytime selfie demo added

`/attendance/demo` now supports a reference selfie, explicit consent, encrypted descriptor persistence, camera matching, saved latest demo Present timestamp, reset, and removal. Separate SQLite v3 tables keep demo data apart from class records. Replacement clears the prior demo result. Every attempt compares the face, including after a previous success; mismatch preserves only the historical result.

Verification: 75 unit/integration tests pass; lint, typecheck, production build pass. Both new desktop/mobile browser tests pass using actual face models and actual demo API with a photographic canvas video stream (no mocked attendance response). Existing four real-model browser tests also pass. The first new browser attempts failed from an ambiguous test selector and a five-second model-load wait; corrected selectors and a bounded 30-second enrollment wait passed. Physical webcam/live-person verification remains pending. User asked to wrap due to usage limit; no GitHub actions performed.

1. Read the task list and this handoff. Check the local Git working tree. The user owns GitHub setup.
2. On an approved physical card and with the student's consent, verify card portrait extraction and a live-person camera match in an open five-minute period, then a second period. Keep this evidence separate from the photographic replay test.
3. If Chrome DevTools MCP becomes available, repeat network/console inspection there. Its profile-lock error is recorded above; Playwright MCP already supplied equivalent browser evidence.

Task 1 real-model behavior is verified. Keep Tasks 3, 4, and final acceptance open until the physical-card/live-person journey is verified.
