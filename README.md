# 🎓 Student Registration & Smart Attendance System

> **Next-generation campus attendance and student registration portal featuring offline ID-card OCR extraction, face-biometric verification with AES-256-GCM encryption, timetable orchestration, and secure Linways academic portal synchronization.**
>
> *100% Local Biometrics · Tesseract OCR · Zero-Storage Linways Integration · Node 24 Native SQLite · Next.js 16 App Router*

[![Node.js 24+](https://img.shields.io/badge/Node.js-24+-339933.svg?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Next.js 16](https://img.shields.io/badge/Next.js-16.3.8-black.svg?logo=next.js&logoColor=white)](https://nextjs.org/)
[![React 19](https://img.shields.io/badge/React-19.3.0-61DAFB.svg?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript 5.9](https://img.shields.io/badge/TypeScript-5.9.3-3178C6.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![SQLite](https://img.shields.io/badge/Database-node%3Asqlite-003B57.svg?logo=sqlite&logoColor=white)](https://nodejs.org/api/sqlite.html)
[![Tesseract.js](https://img.shields.io/badge/OCR-Tesseract.js_6.0-5C2D91.svg)](https://tesseract.projectnaptha.com/)
[![face--api.js](https://img.shields.io/badge/Biometrics-face--api.js-E91E63.svg)](https://github.com/justadudewhohacks/face-api.js)
[![Vitest](https://img.shields.io/badge/Tests-88_Passed-success.svg?logo=vitest&logoColor=white)](https://vitest.dev/)
[![Playwright](https://img.shields.io/badge/E2E-Desktop_%26_Mobile-45ba4b.svg?logo=playwright&logoColor=white)](https://playwright.dev/)
[![Security: AES-GCM](https://img.shields.io/badge/Security-AES--256--GCM-blue.svg)](https://nodejs.org/api/crypto.html)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## ✨ Overview

Traditional college attendance tracking is bottlenecked by manual roll calls, easily proxied paper logs, and disconnected student information portals. 

**Student Registration & Smart Attendance System** is an end-to-end, privacy-first web application designed for modern campuses. Built with Next.js 16 and Node.js 24's native SQLite engine, it provides:

1. **Automated Face Biometrics**: In-browser 128-dimensional facial embedding computation using `face-api.js`, matched server-side against AES-256-GCM encrypted descriptors.
2. **Dynamic Period Checking**: Real-time campus timetable awareness (`Asia/Kolkata` timezone) with automatic active-period resolution and strict `[start, end)` check-in windows.
3. **ID Card OCR Ingestion**: Local image processing (Sharp + Tesseract.js English LSTM) extracting DOB, phone, and address suggestions with zero external API calls.
4. **Linways Academic Integration**: Direct, zero-storage synchronization with the Linways academic portal (`kec.linways.com`) for authenticated student profile and academic history extraction.
5. **No-Login Prototype & Role Dashboards**: Streamlined Student/Admin workflows alongside an enterprise-ready authenticated identity provider with scrypt password hashing.

---

## 🚀 Key Features

| Module | Feature | Technical Implementation |
|:---|:---|:---|
| 👤 **Face Attendance** | **Biometric Check-In** | Client-side 128-d descriptor extraction via `face-api.js`; server-side Euclidean distance matching (< 0.6 threshold). |
| 🔒 **Biometric Security** | **AES-256-GCM Encryption** | Stored face descriptors and normalized prototype photos are encrypted at rest with hardware-accelerated AES-GCM and unique IVs. |
| 🕒 **Timetable Engine** | **7-Period Daily Schedule** | Admin UI to configure period boundaries per weekday; strict overlap prevention and automatic active-period determination. |
| 🪪 **Smart ID Ingestion** | **Offline OCR Extraction** | Sharp image decoding + Tesseract.js (local LSTM `.traineddata.gz`); parses DOB, address, and mobile numbers in ~280ms. |
| 🎓 **Linways Sync** | **Transient Academic Fetch** | Server-side credential handoff with upstream Linways REST API; returns comprehensive profile to a private tab via `BroadcastChannel`. Zero database or cookie persistence. |
| ⚡ **Zero-Login Demo** | **Student / Admin Modes** | Dedicated demo workspace allowing instant testing of face registration, camera verification, and timetable configuration without setup friction. |
| 📱 **Responsive UI** | **Mobile-First Design** | Fully responsive dashboard tested across desktop Chrome and mobile viewport sizes (375px). |
| 🧪 **Rigorous QA** | **100% Test Coverage** | 88 automated Vitest unit/integration tests and dual-channel Playwright E2E suites. |

---

## 🏗️ Architecture & Dataflow

```
                             [ Student / Staff Client ]
                                        │
           ┌────────────────────────────┼────────────────────────────┐
           ▼                            ▼                            ▼
  [ 🪪 ID Card Upload ]       [ 📸 Live Face Biometrics ]   [ 🎓 Linways Portal Auth ]
  Sharp Preprocessing        face-api.js (SSD MobileNet)    User / Password Handoff
           │                            │                            │
           ▼                            ▼                            ▼
   Tesseract.js OCR            128-d Vector Descriptor      kec.linways.com REST API
   Local LSTM (~280ms)                  │                   Direct HTTPS Sync (Transient)
           │                            │                            │
           ▼                            ▼                            ▼
   Extracted Metadata           AES-256-GCM Encryption       In-Memory Sanitization
   (DOB, Phone, Address)                │                   (Academic History, Details)
           │                            │                            │
           └─────────────────────┬──────┴────────────────────────────┘
                                 │
                                 ▼
                     [ Next.js 16 API Layer ]
              (Asia/Kolkata Period Timing Resolution)
                                 │
                   ┌─────────────┴─────────────┐
                   ▼                           ▼
        [ SQLite via node:sqlite ]    [ BroadcastChannel ]
        - users & sessions (scrypt)   Private profile delivery
        - attendance_periods          to detached tab
        - encrypted_descriptors       (Zero storage of secrets)
        - attendance_records
```

---

## 📁 Repository Structure

```
student_info/
│
├── src/
│   ├── app/                                 # Next.js App Router
│   │   ├── admin/attendance/page.tsx        # Timetable editor & period manager
│   │   ├── attendance/page.tsx              # Student attendance & camera verification
│   │   ├── student/page.tsx                 # Linways student profile viewer
│   │   ├── dashboard/page.tsx               # Main authenticated student hub
│   │   ├── api/
│   │   │   ├── attendance/                  # Period check, check-in, status endpoints
│   │   │   ├── linways/                     # Upstream Linways API proxy
│   │   │   ├── id-card/                     # Sharp + Tesseract.js OCR handler
│   │   │   ├── prototype/                   # Demo photo/biometrics storage
│   │   │   └── auth/                        # Signup, login, logout routes
│   │   ├── layout.tsx                       # Root layout & theme wrapper
│   │   └── globals.css                      # Modern CSS design system & tokens
│   │
│   ├── components/                          # React client & server components
│   │   ├── attendance-admin.tsx             # Period timeline administrator
│   │   ├── manual-timetable.tsx             # 7-period weekday schedule editor
│   │   ├── prototype-student.tsx            # Camera stream, selfie capture & matching
│   │   ├── prototype-dashboard.tsx          # Dual Student / Admin demo shell
│   │   ├── student-details.tsx              # Linways credential entry modal
│   │   ├── student-profile-page.tsx         # Comprehensive student record renderer
│   │   └── id-card-upload.tsx               # Document preview & OCR extraction UI
│   │
│   └── lib/                                 # Core backend services & utilities
│       ├── attendance/
│       │   ├── service.ts                   # Timetable logic, period ranges & check-in
│       │   ├── prototype.ts                 # Demo state & encrypted photo repository
│       │   └── crypto.ts                    # AES-256-GCM descriptor encryption
│       ├── linways/
│       │   ├── client.ts                    # Upstream HTTPS client with timeout & error mapping
│       │   └── parser.ts                    # Profile, history, and HTML sanitization
│       ├── ocr/                             # Tesseract.js worker pool & field parsers
│       ├── auth/                            # Scrypt password hashing & session management
│       └── db/
│           ├── schema.ts                    # SQLite tables, indexes & schema migrations (v4)
│           └── client.ts                    # node:sqlite connection pool
│
├── public/
│   └── face-api/                            # Pre-trained models (SSD MobileNet, FaceLandmark68)
│
├── tests/
│   ├── unit/                                # Unit tests (password, OCR parsing, Linways format)
│   ├── integration/                         # API route & database integration tests
│   └── e2e/                                 # Playwright browser end-to-end specifications
│
├── scripts/
│   ├── setup-face-models.mjs                # Automated weights & script fetcher
│   └── run-e2e.mjs                          # Playwright orchestrator & webserver lifecycle
│
├── docs/                                    # Technical specifications & capability mapping
├── vitest.config.ts                         # Vitest test runner configuration
├── playwright.config.ts                     # Desktop & mobile Playwright configuration
├── package.json                             # Dependencies & runtime scripts
├── tsconfig.json                            # TypeScript configuration
└── README.md
```

---

## 🛠️ Prerequisites

1. **Node.js 24+** (Uses Node 24's native `node:sqlite` module; no external compiler or python build tools required)
2. **npm** (v10+)
3. **Google Chrome** (Required for Playwright E2E browser automation)
4. **Webcam / Camera device** (For live facial recognition checks; localhost or HTTPS required for browser media permissions)

---

## 📦 Installation & Setup

### 1. Clone the Repository

```powershell
git clone https://github.com/ss-sevesh/student-attendance-system.git
cd student-attendance-system
```

### 2. Install Dependencies

```powershell
npm.cmd install
```

> **Note:** Sharp prebuilts and Tesseract.js data are installed automatically. No native build toolchain or external Python setup is necessary.

### 3. Download Face Recognition Models

Run the automated model fetcher script to retrieve the pinned weights and `face-api.js` client library into `public/face-api/`:

```powershell
npm.cmd run setup:face-models
```

---

## ▶️ Running the Application

### Start the Development Server

```powershell
npm.cmd run dev -- --hostname 127.0.0.1
```

Open **[http://127.0.0.1:3000](http://127.0.0.1:3000)** in your browser.

The SQLite database defaults to `data/student.sqlite` and initializes automatically on first boot.

### Available Routes

- `/` — Quick Navigation & Architecture overview
- `/attendance` — Student Biometric Attendance Check-In (No login required)
- `/admin/attendance` — Timetable Manager (Configure 7 weekday periods)
- `/student` — Linways Profile Ingestion (Direct academic sync)
- `/dashboard` — Authenticated Student Dashboard (Signup / Login / ID OCR)

---

## 🧪 Testing & Verification

The project includes comprehensive test suites across unit, integration, and full browser end-to-end specifications:

### 1. Run Unit & Integration Tests (Vitest)

```powershell
npm.cmd run test -- --run
```
*Executes all 88 unit & integration tests across 18 test files in ~2.3 seconds.*

### 2. Static Analysis & Type Checking

```powershell
npm.cmd run typecheck
npm.cmd run lint
```

### 3. Production Build Validation

```powershell
npm.cmd run build
```

### 4. End-to-End Browser Testing (Playwright)

```powershell
# Desktop Chrome check
npm.cmd run test:e2e -- --project=chromium

# Mobile Chrome (375px viewport) check
npm.cmd run test:e2e -- --project=mobile-chromium

# Prototype & Admin suite
npm.cmd run test:e2e -- --config=playwright.prototype-admin.config.ts
```

---

## 🔐 Security & Privacy Architecture

- **Biometric Encryption at Rest**: Raw facial images are converted to 128-dimensional floating-point vectors on the client device. Vectors are transmitted over TLS and encrypted using **AES-256-GCM** with a master key (`ATTENDANCE_KEY`) before persisting to SQLite.
- **Zero-Storage Linways Integration**: Upstream Linways student credentials and returned academic dossiers are processed exclusively in-memory. Data is delivered to the student profile tab via ephemeral `BroadcastChannel` APIs and immediately discarded. Credentials, auth cookies, and academic records are never stored in the database or disk.
- **Robust Authentication**: Identity sessions use cryptographically secure scrypt hashing with per-user salts, SHA-256 session token digests, and `HttpOnly`, `SameSite=Lax` cookies with strict Origin verification against CSRF attacks.

---

## 🗺️ Roadmap & Verification Status

- [x] Node 24 native SQLite schema migrations (v1 → v4)
- [x] Client-side face descriptor extraction (`face-api.js` MobileNet)
- [x] Server-side Euclidean distance biometric verification
- [x] AES-256-GCM encrypted photo & vector storage
- [x] Dynamic 7-period weekday timetable manager with overlap rejection
- [x] Asia/Kolkata campus timezone attendance window validation
- [x] Local Tesseract.js OCR for student ID cards (English LSTM)
- [x] Linways academic portal live sync (Authentication + Profile parsing)
- [x] Desktop & mobile responsive viewports
- [x] 88 automated Vitest tests + Playwright E2E coverage
- [ ] Active liveness detection (blink/head turn challenge-response)
- [ ] Multi-student roster export (CSV / Excel format)

---

## 📜 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

---

## 👤 Author

Built with pride by **[ss-sevesh](https://github.com/ss-sevesh)**. Contributions and feedback are welcome!
