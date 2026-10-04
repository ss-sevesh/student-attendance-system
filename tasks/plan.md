# Implementation Plan: Identity and Dashboard Foundation

Status: Approved for implementation by the user on 2026-10-04. Task list target: [todo.md](todo.md).

## Overview

Implement only module `identity` from [SPEC-identity.md](../SPEC-identity.md). The user's request to enter planning is treated as acceptance of its password/session defaults. SQLite remains the initial provider; the user's later preference for a possible Supabase swap adds a provider boundary. OCR, Linways and reviewed-profile each retain their separate specification gates.

Workspace inspection found Node.js 24.19.0, npm 11.17.0, existing requirements documents, and no application manifest. No prior tasks/plan.md or tasks/todo.md existed. No implementation or package installation has occurred.

## Architecture Decisions

- Use Next.js App Router with Node runtime for database/auth routes. Keep session resolution on the server and avoid shared caching of personalized responses.
- Use explicit asynchronous `IdentityStore` operations for account lookup, atomic account/session creation, session lookup and revocation. SQLite details live only in its adapter. This is a small domain interface, not a generic database framework.
- Put signup/login/logout/current-user behavior behind an `IdentityProvider` facade. Routes handle HTTP, cookies and safe errors; forms use the application endpoints. Current-user returns the stable public user ID/email contract.
- Keep application user IDs opaque and stable across future provider changes; future profile records refer to that application ID. Managed Auth IDs may need a mapping.
- Initial hashing uses asynchronous Node scrypt with random salts, versioned parameters and timing-safe verification. Select explicit memory parameters, bound stored hash inputs and measure verification on this machine before accepting the service.
- Use SQLite uniqueness constraints and a transaction for signup/session creation. Use foreign keys and versioned schema setup; protect existing databases from destructive recreation.
- Auth mutation helpers reject missing or mismatched Origin, enforce JSON and a small bounded payload, and produce safe errors. Cookie policy is centralized. Temporary tests use their own database.
- No Supabase package, project, credentials, connection or cloud schema is needed for this plan.

## Dependency Graph and Build Order

```text
1 manifest -> 2 app shell -> 3 test tooling
                              |-> 4 storage adapter --|
                              |-> 5 password logic ---|-> 6 session/provider
                                                          -> 7 signup/dashboard
                                                          -> 8 login
                                                          -> 9 logout
                                                          -> 10 browser acceptance
                                                          -> 11 delivery
```

Tasks 1–6 are the minimum shared foundation. Tasks 7–9 deliver complete user-facing paths, each verified before the next. See todo.md for acceptance criteria, file budgets and focused commands. Review checkpoints follow Tasks 3, 6, 9 and 11.

## Future Supabase Migration

These are design considerations, not approved migration tasks:

1. **Database-only replacement:** keep application-owned credentials/sessions and implement the storage contract for Supabase Postgres. Translate SQLite schema/types/transactions; test ownership and constraints against the new provider. Do not assume the Data API exposes arbitrary transaction behavior.
2. **Supabase Auth adoption:** replace the identity provider, revisiting cookies, token refresh, expiry, signup/email-confirmation, error mapping and revocation semantics. A database adapter alone is insufficient. Supabase documents separate server/browser clients and cookie handling in its [SSR guide](https://supabase.com/docs/guides/auth/server-side/creating-a-client?queryGroups=framework&framework=nextjs).
3. Before either migration, approve a migration spec, check current changelog/docs, back up local data, map stable IDs, reconcile profile ownership, validate cross-account denial and rehearse rollback.
4. Do not assume existing scrypt hashes can be imported into managed Auth. Verify supported import formats at migration time and select a compatible transfer/reset path. Expect existing local sessions to require signin again unless a verified alternative is specified.
5. If tables are exposed through the Data API, define explicit grants and ownership RLS policies. Keep secret/service-role keys server-only. Managed Auth semantics must be tested rather than hidden behind the interface.

## Compatibility Verification

Official references consulted:
- [Next.js installation](https://nextjs.org/docs/app/getting-started/installation)
- [Node 24 crypto](https://nodejs.org/docs/latest-v24.x/api/crypto.html)
- [better-sqlite3 maintainer documentation](https://github.com/WiseLibs/better-sqlite3)
- [Vitest guide](https://vitest.dev/guide/)
- Supabase SSR guide linked above.

Docs establish the approach, not successful Windows native installation. Task 1 resolves and pins mutually compatible release versions; Task 4 verifies native SQLite loading on the actual installed Node build. Record final versions in the manifest/lockfile and README. The Supabase markdown changelog fetch failed with unsupported content type; repeat through a supported client before any migration implementation.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Native SQLite driver installation fails on Windows/Node 24 | High | Test early at Task 4; diagnose before auth work; revise provider choice explicitly if needed. |
| Later managed Auth migration changes security behavior | High | Separate storage/provider contracts; migration spec and contract tests; no promise of a drop-in swap. |
| Password hashing consumes excessive memory/CPU | Medium | Async hashing, bounded inputs, recorded parameters and local measurement. |
| Signup race or partial writes | High | Unique canonical email constraint and atomic account/session creation. |
| Personalized data leaks through cache or incorrect ownership | High | Server-verified identity, uncached personal responses and two-account tests. |
| Session cookie or origin mismatch across local hosts | Medium | One documented application origin and centralized cookie policy; test invalid origins. |
| Scaffolding overwrites requirements | Medium | Create files explicitly; preserve existing documents and inspection artifacts. |

## Parallelization Opportunities

Tasks 4 and 5 are independent after Task 3, but shared manifest/schema changes are sequential. UI/API slices share the provider contract and proceed in order. Documentation can be prepared once behavior is stable. This describes possible scheduling; no delegated agents are required.

## Definition of Done

Every completed task satisfies its acceptance criteria, relevant runtime verification, focused regression tests, lint/type checks when available, scoped readable code and safe error handling. Checkpoints require a production build and all available tests. Record actual outcomes; never check off blocked verification. Final completion requires all identity success criteria, setup documentation, account ownership/security review and human review. No commit, merge or deployment is part of this plan.

## Open Decisions

- Exact package versions are pinned during Task 1; native-driver and hashing suitability are measured during Tasks 4–5.
- A later Supabase change requires choosing database-only versus managed Auth; no decision is needed now.
- Registration is visibly pending until its owning modules are implemented.
- Request Linways URL/credentials only when that module reaches authenticated inspection; never add them to planning files.

## Review Gate

Approve this plan and its task list before implementation. Checkpoints also require human review as stated by the invoked planning skill.
