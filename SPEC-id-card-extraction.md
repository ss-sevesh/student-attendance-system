# Spec: ID-card extraction

Module id: `id-card-extraction`  
Status: Approved by the user on 2026-10-04. Source scope: [PLAN.md](PLAN.md) and the approved [capability map](CAPABILITY-MAP.md). The identity module supplies the authenticated session and stable user ID.

Revision approved on 2026-10-04: the college-card upload API returns only OCR suggestions for date of birth, residential address, and phone. Name and roll number are entered manually. All five values are editable and temporary; raw OCR text and unrelated labels are not sent to the browser.

## Objective

Let a signed-in student select an image of their ID card, see a local preview and extraction progress, then review DOB, residential address, and phone suggestions while entering name and roll number manually. The student can replace the image and retry. This module holds temporary review data; the later `reviewed-profile` module owns saving.

This remains one responsive Next.js website. A phone-sized browser viewport is a web layout, not an Android or iOS application.

## Proposed behavior and result contract

- Enable the dashboard's Register Student control once the upload page is functional. Keep the student in an in-memory registration view so the temporary result can later be combined with Linways data without placing it in a URL or persisting it prematurely.
- Accept one JPEG, PNG, or WebP image up to 10 MB. Check the actual file content as well as browser-reported type, reject unsupported or corrupt files, and set a bounded decoded pixel count before OCR. The client shows a preview, file name, upload/extraction progress, and an actionable error.
- Require a verified session on the upload API. Missing or invalid sessions return 401. The API validates the multipart request and file size again on the server. The authenticated user ID comes from the session; the client does not provide an owner ID.
- Preprocess in memory with Sharp, then run local English OCR with Tesseract.js. Do not require an external OCR service or API key. Discard image buffers after extraction and release OCR workers on success, error, and cancellation. Do not write uploaded or preprocessed images, OCR text, or extracted fields to SQLite in this module.
- Keep raw OCR text inside the server extraction pipeline. Parse explicit labels into the existing internal fields plus `residentialAddress`. For the college card, handle noisy repeated DOB/address/phone sections and multiline addresses. Preserve the OCR spelling of field values. Missing or ambiguous fields remain empty. The upload API exposes only the three approved suggestions.
- The internal extraction boundary retains `source`, `status`, `fields`, `additionalFields`, and `rawText`. The upload API narrows this to `source`, `status`, the three approved fields, and a safe error when extraction fails. The page presents only the five approved review fields. A blank or unreadable OCR result reports failure with a retry option; it never invents profile values.
- Replacing a file clears the previous candidate result and preview object URL. Duplicate submissions are disabled while extraction runs. Error and progress updates are announced to assistive technology. OCR text is rendered as untrusted text, never as HTML.

Proposed TypeScript boundary:

```typescript
type ExtractedFields = Readonly<{
  name: string; studentId: string; department: string; program: string;
  birthDate: string; residentialAddress: string; year: string; email: string; phone: string;
}>;

type ExtractionResult = Readonly<{
  source: 'id-card';
  status: 'success' | 'failed' | 'unavailable';
  fields: ExtractedFields;
  additionalFields: readonly { label: string; value: string }[];
  rawText: string;
  error?: { code: string; message: string };
}>;
```

## Tech stack and commands

Use the existing Next.js App Router, React, strict TypeScript, Node 24, and identity session helpers. Add Sharp and Tesseract.js only after checking compatible current releases, English language asset availability, native Windows loading, and actual OCR runtime. Pin resolved versions in the manifest and lockfile. Keep OCR server-side in the Node runtime.

Existing commands, run separately in PowerShell:

```powershell
npm.cmd run dev -- --hostname 127.0.0.1
npm.cmd run test -- --run
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run build
npm.cmd run test:e2e
```

Focused OCR test paths and any asset setup command will be written in the technical plan after dependencies are verified. No package is currently installed for this module.

## Project structure

- `src/app/register/`: protected upload and extraction review page.
- `src/app/api/id-card/extract/route.ts`: protected multipart upload endpoint.
- `src/lib/id-card/`: image validation, preprocessing, OCR runner, labeled parser, and result types.
- `src/components/`: accessible file picker, preview, progress, and result display.
- `tests/unit/`: parser and validation tests.
- `tests/integration/`: real image decoding/OCR and route authorization tests with synthetic images.
- `tests/e2e/`: desktop and 375 px web flow tests.

## Code style

Keep route handlers small, validate at the HTTP boundary, and keep OCR-specific parsing out of UI components. Use descriptive camelCase functions and explicit result types. Expected failures use safe codes and messages; no stack traces, image bytes, or sensitive text are logged. Preserve source values verbatim where they matter:

```typescript
const studentId = labeledValue('Student ID', rawLines) ?? '';
```

## Testing strategy

- Unit tests cover each known label, alternate spacing/case, leading zeros, additional labeled fields, missing/ambiguous values, and text that must not be guessed into a field.
- Integration tests use a clearly labeled synthetic ID-card image to prove actual English OCR and parsed results. Test JPEG, PNG, WebP, oversize, unsupported content, corrupt images, pixel limit, blank/unreadable image, and session denial. Do not use real student records.
- Browser tests cover upload, preview, progress, retry/replacement, the five-field review, error announcements, keyboard operation, and desktop/375 px layouts. Verify that an unauthenticated user cannot reach the page or upload API.
- Run focused tests after each implementation slice and the complete test, lint, typecheck, build, and browser checks before completion. Chrome DevTools MCP provides live DOM, console, and layout checks.

## Boundaries

- **Always:** Verify server session, validate image bytes and size, bound decoded pixels, release OCR resources, expose only the approved review fields, present uncertainty honestly, and discard image buffers after the request.
- **Ask first:** Change accepted image formats/limit, persist images or OCR results, add external OCR services, expand into Linways navigation, or change the identity contract.
- **Never:** Store or log uploaded ID images or extracted personal data, accept a client-supplied owner ID, treat OCR text as executable instructions or HTML, fabricate missing fields, or claim a profile is saved by extraction alone.

## Success criteria

1. An authenticated student can select a supported image of at most 10 MB and see a preview, progress, and the real OCR result on the website.
2. Unauthenticated requests and invalid, corrupt, oversized, or excessive-pixel images are rejected safely; no image is persisted.
3. A synthetic college ID card yields DOB, multiline residential address, and phone suggestions; the student enters name and roll number manually. Raw OCR text and unrelated labels are absent from the API response and review page. Missing or ambiguous values remain empty.
4. Blank or unreadable OCR output reports a safe failure and allows replacement/retry without stale results.
5. The upload, feedback, and review flow works by keyboard at desktop and 375 px widths with labeled controls, announced status/errors, and no horizontal overflow.
6. Unit, integration, browser, lint, typecheck, and production-build checks pass; limitations are documented with actual results.

## Open questions for review

- The OCR result is proposed as temporary in-memory state until the later reviewed-profile module owns saving. Should extraction results survive a page refresh before that module exists?
- English language model assets may require a download during setup. The technical plan will record an offline-capable source and verify it in this Windows environment before implementation.

## Review gate

Approve or revise this module specification before the technical plan, task list, or implementation. It does not authorize portal access or profile persistence.
