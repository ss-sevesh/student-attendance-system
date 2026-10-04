# Student Registration Prototype

This repository is a local Next.js web application. Students can create an application account, sign in, upload an ID-card image, and review date of birth, residential address, and phone suggestions. They enter name and roll number manually. A local period-attendance prototype is also available. The ID-card review is temporary and is not a saved profile. Linways extraction and reviewed-profile save/reopen are separate modules not yet implemented. There is no mobile app; the 375 px checks exercise the responsive website.

## Attendance prototype

Copy `.env.example` to `.env.local`, set `ADMIN_EMAIL` to the email of an application account, and restart the app. That account can open **Manage timetable** from the dashboard to add/remove weekly periods. The initial demo timetable has 09:00 and 09:45 periods Monday–Friday. Check-in opens at each period start and closes five minutes later using `ATTENDANCE_TIMEZONE` (default `Asia/Kolkata`), based on the server clock.

A student opens **Period attendance**, uploads an ID card containing one clear face portrait, checks the enrollment box, and selects **Enroll face from card**. Only an AES-GCM-encrypted 128-number face descriptor is saved; the original card image is not uploaded for enrollment. The key is generated in ignored `data/attendance.key` for local use, or set `ATTENDANCE_KEY` to 64 hexadecimal characters. Keep the key when moving the database, or enrolled references cannot be read. **Remove face reference** deletes the stored descriptor. During an open period, the student starts the browser camera and selects **Check in**; the server records one result per student/date/period. The app needs camera permission and HTTPS outside localhost.

Run `npm.cmd run setup:face-models` once on a machine with internet access. It downloads the pinned face-api.js script and model weights into `public/face-api/`; the browser then loads them from this app's origin. See [face-model setup](docs/face-models.md). In this workspace, real-model browser checks confirmed that a blank image is rejected and a photographic portrait yields a 128-number descriptor and enrolls. A controlled photographic video stream also matches through the model, but a physical ID card and a live person at a camera have not been verified. This is a demo, **not trustworthy real attendance**: the browser computes the descriptor, a modified browser request can replay it, the model has no validated liveness check, and the ID-card holder is not independently verified. A printed photo or video may fool it. Use staff review for any real decision. Do not enroll real student data until the institution has an approved biometric process.

## ID-card OCR setup

Sharp (image decoding) and Tesseract.js (local English OCR) install as part of the regular `npm install`. No additional manual download or API key is required.

**Verified versions (Node 24.19.0, Windows x64):**

| Package | Version | Notes |
|---|---|---|
| `sharp` | 0.34.2 | Windows x64 prebuilt, Node-API v9 |
| `tesseract.js` | 6.0.1 | `6.1.0` does not exist in the registry |
| `@tesseract.js-data/eng` | 1.0.0 | local English LSTM data, no runtime CDN fetch |

**Local English language asset:**
```
node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz
```
Resolved at runtime via `process.cwd()`. Workers are configured with `cacheMethod: 'none'` and `gzip: true` — no cache directory is written.

**DPI warning (non-fatal):** Tesseract WASM prints `Warning: Invalid resolution 25 dpi. Using 70 instead.` to stderr for SVG-derived images. OCR output is unaffected.

**Measured OCR latency:** ~276–308 ms (500 × 260 px synthetic card, cold worker, English LSTM, Windows).

Sign in, choose one JPEG, PNG, or WebP image up to 10 MB from **Register Student** on the dashboard, then select **Extract Details**. The review page shows only editable date of birth, residential address, and phone suggestions, plus blank name and roll-number inputs for manual entry. OCR noise, raw text, and unrelated labels are hidden from this review screen. You can replace the image or retry after an error. Images and reviewed values are cleared when you leave or refresh the page. Nothing is saved as a profile. See [ID-card extraction notes](docs/id-card-extraction.md) for verified behavior and limits.

## Run locally

Use Node.js 24 and PowerShell. Run each command separately from this directory:

```powershell
npm.cmd install
npm.cmd run dev -- --hostname 127.0.0.1
```

Open `http://127.0.0.1:3000`. The SQLite database defaults to `data/student.sqlite` in the project directory and is created automatically. `data/`, `.env*`, SQLite files, build output, and dependencies are ignored. To use another database, set `DATABASE_PATH` to an absolute path before starting the server. Never point tests at the development database; Vitest uses a separate temporary database for each test file, and Playwright uses a dedicated temporary database.

The application accepts auth mutations only from its own origin. Set `APP_ORIGIN` to the exact browser origin if using another host, port, or HTTPS. For example, in PowerShell before starting the server:

```powershell
$env:APP_ORIGIN = 'http://127.0.0.1:3000'
```

Sessions use an HttpOnly, SameSite=Lax cookie with a seven-day expiry. The cookie is Secure under HTTPS. Local HTTP development is the explicit exception, so use the same `127.0.0.1` host throughout a session.

## Checks

```powershell
npm.cmd run test -- --run
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run build
npm.cmd run test:e2e -- --project=chromium
npm.cmd run test:e2e -- --project=mobile-chromium
```

The two Playwright projects test the same website in desktop Chrome and at a 375 px phone-sized browser viewport. They use the installed Google Chrome channel. A separate Android or iOS app is not part of this project. Run `npm.cmd run build` first. `test:e2e` starts the production server on `127.0.0.1:3100` and stops it after the tests. The admin config uses port 3105 and a separate temporary database: `npm.cmd run test:e2e -- --config=playwright.admin.config.ts`. If either port already has a server, the runner reuses it; stop unrelated servers before testing. The bundled Chromium download stalled under the agent's network restrictions; installed Chrome completed the browser checks. The `npx.cmd playwright install chromium` command remains available if bundled Chromium is wanted later.

## Identity behavior

Email is trimmed and lowercased for uniqueness. Passwords are kept unchanged and must contain 12–128 Unicode characters. The server hashes them asynchronously with scrypt and a random salt. SQLite stores only a SHA-256 digest of each random session token. Expired or revoked sessions cannot open `/dashboard`; downstream modules must derive the stable application user ID from the server session and constrain their own data by that ID.

`POST /api/auth/signup` returns HTTP 201 and public user fields, or 400 for invalid input and 409 for a duplicate canonical email. `POST /api/auth/login` returns HTTP 200 and a fresh session, or a generic 401 for unknown email or wrong password. `POST /api/auth/logout` revokes the current session, clears the cookie, and returns 204 even when already signed out. Mutation requests require a matching Origin. API errors use `{ "error": { "code": "...", "message": "..." } }` and do not expose hashes or tokens.

The SQLite adapter uses Node 24's built-in `node:sqlite` driver. The planned `better-sqlite3` install could not reach npm in this environment (`EACCES`); persistence, transactions, foreign keys, and session behavior were verified with real SQLite files. See [identity provider notes](docs/identity-provider.md) for migration boundaries and verification evidence.

## Current limits

This is a local prototype. Email verification, password reset, social login, distributed rate limiting, and production deployment are outside the identity specification. Linways and reviewed-profile work follow the module boundaries in [CAPABILITY-MAP.md](CAPABILITY-MAP.md). Linways credentials must never be stored in this repository or database.

Vitest 4.1.11 currently emits a future Vite config-loader warning, although tests pass. The last reported npm audit contained five high entries from one development lint dependency chain ending at `braces` 3.0.3; the npm advisory endpoint was inaccessible to the agent, so the current count is unverified. The [upstream advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) listed no patched release at the time of review. Keep `eslint-config-next` aligned with Next.js 16.3.8 and recheck the advisory before release.

The accepted [identity specification](SPEC-identity.md), [implementation plan](tasks/plan.md), and [task list](tasks/todo.md) describe scope and review checkpoints.
