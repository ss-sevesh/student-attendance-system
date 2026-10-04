# Capability Map: Student Registration Prototype

Status: Approved by the user on 2026-10-04. Module specifications still require their own review.

Source requirements: [PLAN.md](PLAN.md).

## Module boundaries

| Module id | Responsibility | Depends on |
|---|---|---|
| identity | Email/password accounts, hashed passwords, database-backed sessions, protected dashboard, and session ownership contract. | — |
| id-card-extraction | Protected temporary image upload, validation, preprocessing, local English OCR, labeled-field parsing, raw text review, and retry. | identity |
| linways-integration | Protected transient credential submission, isolated Playwright contexts, configurable portal navigation and extraction, truthful errors, and security-challenge handling. | identity |
| reviewed-profile | Compare source results, preserve original values and provenance, resolve conflicts, allow explicit partial continuation, save the reviewed profile, and reopen it from the dashboard. | identity, id-card-extraction, linways-integration |

Build order: identity → id-card-extraction and linways-integration → reviewed-profile.

The two extraction modules can be developed independently after identity's access contract is specified. Reviewed-profile consumes their result contracts; failed or unavailable extraction must remain a supported outcome.

## Assumptions carried forward for review

- One local Next.js application with TypeScript and SQLite; server-side OCR and Playwright run in the same application. No queues, containers, or separate deployed services.
- The original plan's UI, privacy, supported image formats, 10 MB upload limit, and verification requirements remain the source scope.
- Identity owns the authenticated user/session contract. Each extraction module owns its result contract; their specifications must align on source, status, fields, additional fields, and safe errors.
- Reviewed-profile owns persistence of reviewed source values and corrections. Its dashboard view depends on identity; identity does not depend on profile storage, avoiding a dependency cycle.
- Uploaded images and portal credentials are temporary. No persisted credentials, browser sessions, authenticated screenshots, traces, or sensitive request-body logs.
- The existing repository contains PLAN.md but no application manifest or source code. Framework versions, executable build/test commands, source layout, and testing tools will be specified rather than represented as already available.

## Questions to resolve during specification

- PLAN.md calls the portal “Lineways,” while its URL is kec.linways.com. Confirm the intended display name and target institution.
- Portal credentials are referenced in PLAN.md but are not present in the inspected project. Real authenticated navigation and field mappings remain unverified; credentials are not required for this capability-map review.
- The user is ready to provide the portal URL and credentials when needed. Request them at the authenticated integration step; do not record credentials in project documents.
- Define required profile fields, permitted partial-save conditions, and whether saving replaces the latest profile or preserves history.

## Review gate and next artifacts

Review module boundaries, dependency direction, and build order first. No module specification or implementation plan is approved by this document.

After map approval, start Specify with SPEC-identity.md, then proceed through each module's specification, planning, tasks, and implementation gates in dependency order. The module specifications must cover objective, commands, project structure, code style, testing strategy, boundaries, and testable success criteria.

PLAN.md remains the original requirements input. Technical implementation plans and tasks are deferred until the relevant specification has been reviewed.
