# Implementation Plan: ID-card extraction

Status: Proposed for review on 2026-10-04. Specification: [SPEC-id-card-extraction.md](../SPEC-id-card-extraction.md). Task list: [id-card-todo.md](id-card-todo.md). The completed identity plan remains in [plan.md](plan.md); neither identity artifact is replaced.

## Outcome and scope

Add a protected ID-card upload and OCR review step to the existing Next.js website. A signed-in student can preview one JPEG, PNG, or WebP image up to 10 MB, run local English OCR, inspect raw text and conservative labeled fields, and replace/retry. Image and result data remain temporary in the current browser view. The dashboard's Register Student control becomes a working link when that step is ready. Linways navigation and profile saving belong to their own modules.

The user's approval of the spec accepts the proposed in-memory result lifetime: refreshing the page clears an unsaved extraction. That behavior must be clear in the UI until the reviewed-profile module supplies persistence.

## Architecture decisions

- Keep OCR in the Next.js Node runtime. Reuse `getCurrentUser()` for authorization and the existing origin/error helpers for a protected `POST /api/id-card/extract`. No client-supplied user ID is accepted.
- Bound request bytes before multipart parsing. Allow 10 MB for the image plus a small multipart overhead, then require exactly one file under the 10 MB file cap. Parse only the expected form field. Reject unsupported, corrupt, mismatched, and excessively large decoded images with safe error codes. Do not log payloads.
- Use Sharp on an in-memory buffer to inspect the decoded format and dimensions, enforce a conservative input-pixel limit, auto-orient, resize only when useful, and produce a clean OCR input. The route accepts only JPEG, PNG, and WebP even though Sharp can decode more formats. Reject animation/multipage input unless verified safe in the image slice.
- Use a Tesseract.js English worker against a locally available language asset. Obtain and pin that asset in the dependency/setup slice so runtime extraction does not need a network fetch. Create a worker per extraction and terminate it in `finally`; measure latency/memory with a synthetic image before choosing any worker reuse or concurrency policy.
- Return raw text and a conservative parsed candidate result with the spec's `source/status/fields/additionalFields/error` shape. Parse anchored `label: value` or clearly separated label/value lines only; repeated conflicting labels stay empty. Preserve student-ID leading zeros. Keep normalizing/matching across OCR and Linways in the later reviewed-profile module.
- Build one protected `/register` page with file picker, preview, staged pending messages, an accessible result view, and replacement/retry. Use an in-memory React state value and revoke object URLs on replacement/unmount. Do not send OCR data in URLs or save it in SQLite.
- Activate the dashboard Register Student link only after the upload route and page work together. Do not expose a dead action during partial slices.

## Dependency and slice order

```text
1 dependency/native and English-data smoke check
       ├── 2 result contract and conservative parser
       └── 3 image validation, preprocessing, real OCR
                └── 4 protected extract API
                         └── 5 upload and review web flow
                                  └── 6 browser acceptance and delivery docs
```

Tasks 2 and 3 can be developed after Task 1, but both feed Task 4. Checkpoints follow Tasks 1–3, Tasks 4–5, and Task 6. See [id-card-todo.md](id-card-todo.md) for acceptance criteria, expected files, and focused checks. No delegated agents are required.

## Compatibility evidence and installation risk

The installed Node version is 24.19.0. [Sharp's installation guide](https://sharp.pixelplumbing.com/install/) lists Node-API v9/Node >=20.9 and Windows x64 prebuilt support. Its [constructor documentation](https://sharp.pixelplumbing.com/api-constructor/) provides `limitInputPixels`; its [resize API](https://sharp.pixelplumbing.com/api-resize/) supports bounded dimensions. [Tesseract.js's Node API](https://github.com/naptha/tesseract.js/blob/master/docs/api.md) documents `createWorker`, `recognize`, `terminate`, and `langPath`; the maintainer's [local-installation guide](https://github.com/naptha/tesseract.js/blob/master/docs/local-installation.md) explains local language-file paths. These sources establish an approach, not a successful installation in this workspace.

The agent environment previously returned npm registry `EACCES`, so Task 1 attempts installation first and records the resolved versions and lockfile only after success. It also verifies that a real English data asset is available locally and that Sharp and the OCR worker load on Windows. If this cannot be verified, stop before building routes that pretend OCR is operational; record the blocker and request only the concrete installation action needed.

## Tests and runtime verification

- Unit: labeled parsing, ambiguity, missing values, additional labels, preserved leading zeros, and unsupported MIME/byte signatures.
- Integration: protected route denial, bounded multipart body, decoded format/pixel validation, worker cleanup, and real OCR of a clearly labeled synthetic card. Add JPEG/PNG/WebP and blank/corrupt fixture cases without real student records.
- Browser: authenticated upload to raw-text review, progress and disabled duplicate submission, replacement/retry, safe failures, keyboard labels/live regions, unauthenticated redirect, and 1280 px/375 px website layout. Use Playwright plus Chrome DevTools MCP inspection.
- At each checkpoint run relevant tests, lint, typecheck, and build. Run the full identity and OCR suites before calling the module done. Check that the development SQLite file contains no OCR result or image.

## Risks and mitigations

| Risk | Impact | Response |
|---|---|---|
| npm registry or English asset unavailable | High | Verify first; use a pinned local asset; do not claim OCR from parser-only tests. |
| Windows native Sharp load fails | High | Smoke test on installed Node before API/UI work; record alternate compatible package choice for review if needed. |
| Decompression bomb or oversized multipart body | High | Enforce raw byte, decoded pixel, format, and animation limits before OCR. |
| OCR misreads an ID or invents a field | High | Preserve raw text and originals; parse labels conservatively; leave uncertain fields empty. |
| OCR worker consumes too much memory or hangs | Medium | Per-request cleanup, bounded inputs, measured synthetic latency, and safe failure/time limit. |
| Temporary sensitive data leaks into files, logs, or URLs | High | In-memory processing and UI state, object URL cleanup, no request-body logging or DB writes. |
| Later Linways/review module needs result state across navigation | Medium | Keep the registration view as the composition point; define the result contract now and revisit state lifetime in that module's approved spec. |

## Definition of done

The six spec success criteria are evidenced by actual tests and browser behavior. The README records setup, English OCR asset location, limitations, and verified commands. The final checkpoint requires all available tests, lint, typecheck, production build, real synthetic-image OCR, and desktop/375 px browser checks. No commit, deployment, Linways connection, or reviewed-profile persistence is part of this plan.

## Review gate

Approve or revise this plan and its task list before implementation. Exact dependency versions, pixel limit, and preprocessing parameters are resolved by Task 1/3 measurements rather than guessed in this plan.
