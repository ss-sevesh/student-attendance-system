# Spec: Period attendance by face verification (draft)

Module id: `attendance`  
Status: Fast local prototype authorized by the user on 2026-10-04. Backend, admin UI, and student UI have passed browser checks. Real face-model assets are installed: a blank image was rejected, a photographic portrait enrolled with a 128-number descriptor, and the model matched the same portrait in a controlled video stream. Physical card ownership and a live-person camera check-in remain unverified. See `tasks/attendance-todo.md` and `tasks/attendance-handoff.md` for exact evidence and pending acceptance. The stricter production requirements below remain future work. This is a new web-app feature requested after ID-card extraction; it is not part of the earlier approved registration capability map.

## Objective

Let an enrolled student check in once for each scheduled class period on a given campus day by presenting their face to the browser camera. In the local prototype, a browser-generated face descriptor is compared with the enrolled reference; this does not prove liveness or prevent a modified request. The student sees the recorded period and time; a failed or unavailable comparison never silently marks attendance. Check-in opens at each period's scheduled start and stays open for five minutes.

This remains the responsive Next.js website, not a native mobile app. No background camera capture or automatic face surveillance is proposed; the student opens the check-in page and starts each verification.

## Proposed behavior

1. **Enrollment:** A signed-in student explicitly opts in to use a face reference extracted from a card image that contains one usable portrait. This is separate from OCR. The app explains what biometric data would be stored, why, and how to delete or replace it. With that explicit enrollment, the app may retain an encrypted face reference for future check-ins; it does not retain the raw card image by default. Encryption keys must be held separately from the database. Enrollment must bind the card/reference to the correct student through an approved identity check; possession of a card image plus an application email account is not sufficient proof. No attendance check-in is enabled before enrollment is verified.
2. **Schedule:** An administrator sets the timetable. The server owns campus date, timezone, period start/end times, and the allowed check-in window. A period is identified by a stable schedule/period ID, not only its display time. For a 09:00 first period, check-in is accepted from 09:00:00 until just before 09:05:00 in campus time. A 09:45 second period independently accepts check-in until just before 09:50:00. The server, not the student's device clock, decides eligibility.
3. **Check-in:** The student opens the attendance page, grants browser camera permission, sees the live preview, and explicitly starts a check-in for the current eligible period. In the prototype, the browser sends a face descriptor; the server checks session, enrollment, time window, and descriptor distance. A passing result records `present` for that student, date, and period. Repeat submissions return the existing record instead of making duplicates. Trusted server-side face processing and liveness are deferred production work.
4. **Failure and review:** Outside the window, camera denial, absent face, multiple faces, poor image, low match confidence, or service failure show distinct safe outcomes. They do not mark absent automatically and do not count as present. Staff correction with actor, time, reason, and audit history is deferred production work; the prototype must direct students to staff rather than pretending a correction workflow exists.
5. **Privacy:** Do not reuse the temporary OCR upload as implicit biometric enrollment. Store no raw card image, check-in videos, or frames by default. Retain only the minimum encrypted face reference, enrollment status, match decision metadata, and attendance records for a defined retention period. Students can see their own records and request reference deletion; staff access is role-restricted. The exact retention and legal/college policy must be decided before deployment.

## Tech stack and commands

Use the existing Next.js 16 App Router, React 19, Node 24, strict TypeScript, SQLite, and session identity provider. Browser capture uses `navigator.mediaDevices.getUserMedia` on a secure origin (HTTPS in deployment; localhost in development), always after user action and browser permission. Select and validate a face detection/matching and presentation-attack detection implementation before coding the enrollment or check-in endpoints. A static photo comparison or simple blink prompt must not be presented as reliable liveness.

Run from PowerShell, separately: `npm.cmd run test -- --run`, `npm.cmd run lint`, `npm.cmd run typecheck`, `npm.cmd run build`, `npm.cmd run test:e2e`. Start local development with `npm.cmd run dev -- --hostname 127.0.0.1`.

## Project structure and code style

- `src/app/attendance/`: protected enrollment/check-in/history pages.
- `src/app/admin/attendance/`: role-restricted timetable and correction pages.
- `src/app/api/attendance/`: protected enrollment, check-in, status, and history endpoints.
- `src/lib/attendance/`: schedule rules, face-verification adapter, decisions, and storage boundary.
- `tests/unit/`, `tests/integration/`, `tests/e2e/`: timing/uniqueness, protected endpoint, and browser interaction tests.
- `docs/attendance.md`: deployment prerequisites, privacy/retention decisions, and operational limits.

Keep biometric provider details behind one adapter; do not mix model inference, time-window logic, and HTTP validation in a route. Use explicit decisions such as `{ status: 'present' | 'already-recorded' | 'outside-window' | 'needs-review'; periodId: string; recordedAt?: string }`. Never return biometric templates or raw frames to the browser after submission.

## Testing strategy

- Unit-test campus timezone boundaries, five-minute window edges, day rollover, overlapping periods, and one record per student/date/period.
- Integration-test session ownership, enrollment prerequisites, spoof/low-confidence/unavailable outcomes, atomic duplicate prevention, deletion/retention, and staff correction audit history. Use synthetic or consented test fixtures, never real student photos in the repo.
- Browser-test camera permission denied, keyboard operation, manual check-in, visible current period and window, success/already-recorded/failed states, and 375 px layout. Use an injected camera/verification fixture for repeatable tests; separately validate the real engine with an approved test set.
- Measure false accepts, false rejects, demographic variation, and presentation-attack resistance before treating this as reliable attendance. A passing UI test does not validate biometric accuracy.

## Boundaries

- **Always:** Obtain explicit enrollment action, enforce access by authenticated student ID, validate time on the server, protect stored references, prevent duplicate attendance, support manual review, and show uncertainty honestly.
- **Ask first:** Persist a raw card portrait or face image, select a biometric vendor/model, define retention and staff roles, or change the current promise that OCR uploads are temporary. The user has approved explicit enrollment with an encrypted face reference, an admin-managed timetable, and a five-minute window starting at each period's scheduled start.
- **Never:** Mark attendance from OCR text alone, treat a face match as certain identity, accept a client-supplied attendance time or student ID, silently fail students as absent, or claim photo/replay resistance without validated presentation-attack detection.

## Local prototype success criteria

1. The model loads from a reproducible source in the development browser; a synthetic or consented photo with one face produces a descriptor, while blank or multi-face images fail clearly.
2. A student can explicitly enroll a card portrait, use the browser camera during an open period, and see one attendance record for that day and period. A separate period can record a separate check-in.
3. Admin timetable changes, authentication, five-minute server window, errors, and duplicate prevention work in desktop and 375 px browser checks.
4. Tests, lint, typecheck, and build pass. The UI and README state that browser-supplied descriptors lack liveness and can be replayed, so the prototype is not for real attendance decisions.

## Production success criteria (deferred)

1. An approved enrolled student can check in once for each eligible scheduled period and see the server-recorded status and time.
2. A student cannot check in for another account, a past/future window, or an unscheduled period by changing client data or device clock.
3. Repeat attempts do not create duplicate records; periods on the same day remain independent.
4. Failed face/liveness checks and camera denial give actionable outcomes and a staff review path without marking present.
5. Enrollment, retention, deletion, staff access, and audit behavior are tested and documented before any real student use.
6. Biometric accuracy and spoof resistance are validated with an approved test set; the app makes no reliability claim based only on demos or browser fixtures.

## Open questions for approval

- The user selected a five-minute window immediately after each start and an admin-managed timetable. Are weekends, holidays, and per-class schedules needed in the first release?
- The user approved a retained encrypted face reference after explicit enrollment. Who verifies that the card belongs to the signed-in student?
- What is the campus timezone, who can correct attendance, and how long must biometric references and attendance records be kept?
- Which approved face/liveness engine and accuracy threshold will the institution accept? This is an external dependency, not yet selected or tested.

## Prototype scope

The user asked to make the prototype quickly and keep the code simple. The local demo uses browser-side face descriptors from same-origin model assets, server-side descriptor distance, and an encrypted reference. It has no validated liveness or identity proofing, so it must not be used to decide real attendance. The existing OCR module remains temporary and unchanged.
