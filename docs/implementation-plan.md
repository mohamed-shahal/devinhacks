# Milestone implementation plan

The scope and ordering below derive from `implement.md` sections 2, 17 and 22. P0 comes before P1; P2 stays deferred. A milestone is complete only when its runnable application behavior and listed checks pass. Update this document with evidence and deviations at each stage, rather than marking the final product checklist early.

## Status

| Milestone               | Status      | Dependency           |
| ----------------------- | ----------- | -------------------- |
| M0 Audit and foundation | Complete    | None                 |
| M1 Schema and renderer  | Not started | M0                   |
| M2 Studio               | Not started | M1                   |
| M3 AI Models            | Not started | M0, M2 integration   |
| M4 Prompt generation    | Not started | M1–M3                |
| M5 Refinement/history   | Not started | M2, M4               |
| M6 Images/assets        | Not started | M1, M3–M5            |
| M7 Persistence/export   | Not started | M1–M6                |
| M8 Hardening/demo       | Not started | All prior milestones |

## M0 — Audit and foundation

Deliver: preserve/copy the supplied specification, record the initial audit, establish npm workspaces (`apps/web`, `apps/api`, `packages/shared`), React/Vite, strict TypeScript, Tailwind, React Router, Query, Zod and Hono. Add formatting, lint, Vitest/Testing Library, Playwright, CI, environment validation, `.env.example`, ignored secret files and documentation. Add real navigation, appearance preference and live health status; future scene tools must be clearly unavailable.

Acceptance: fresh install starts locally; health responds over HTTP; all five routes work on desktop/mobile; settings persist; API failure and retry work; invalid environment fails safely; foreign origins are rejected; API errors do not reveal internal details; typecheck/lint/tests/build pass. No secrets or credential entry, and no claim of scene generation. Verify built API, production guard and static frontend separately.

Verification on 2026-10-25: formatting, lint, strict typecheck, 19 unit/integration tests, production web/API builds and four Playwright tests passed (two flows each on desktop and mobile). The connected local app was visually inspected. Built-artifact/startup and dependency-scan evidence is recorded in `docs/verification.md`. Tests use dedicated loopback ports 5274/8878 and never attach to an unrelated running server. The local `.env` uses 5273/8877 because this machine already has services on the documented defaults; it contains no secrets and is ignored.

## M1 — Schema and renderer

Deliver `packages/scene-schema` with a versioned, strict Zod contract, stable IDs and semantic validators, plus `packages/scene-runtime` using raw Three.js. Define bounded allowlists for object/material/light/animation types. Validate duplicate IDs, parent existence/cycles, finite values, transforms, counts, duration, colors, animation references and approved asset IDs. Establish pure migration policy before additional schema versions.

Runtime owns mount/update/applyPatch/play/pause/reset/seek/quality/resize/dispose; renderer consumes validated data only. Build factories for required primitives, groups, procedural robot with limb pivots, trees/buildings and bounded emitters. Add perspective camera/orbit controls, selection and basic inspector. Implement at least cyberpunk, forest and abstract presets through the same schema. Finish all five environment presets by M8. Unsupported asset imports stay unavailable until M6.

Acceptance/tests: each preset validates and renders; invalid input preserves the current scene; play/pause/reset/seek behave predictably; pixel ratio/lights/particles are capped; resize/context loss/unsupported WebGL are handled; unmount disposes resources and listeners. Unit tests cover malicious/invalid schemas and centralized animation evaluation; browser checks render presets and selection without paid calls.

## M2 — Studio

Deliver desktop panels and mobile drawers/tabs, hierarchy, object transform/material/visibility inspector, duplicate/delete/frame, timeline and track controls, playback speed/loop, bounded immutable undo/redo, grouped edits, save status and validated browser-local draft recovery. Use an application service/repository seam for drafts so M7 can add server persistence. No provider calls in renderer.

Acceptance/tests: a user can build/edit/play a scene without AI; undo/redo restores both scene and runtime; recovery survives refresh; corrupted or old recovery data has a safe failure/migration path; failed storage preserves in-memory edits. Add integration and browser tests for transforms, history, playback and reload. Do not mark a draft as server-saved.

## M3 — AI Models

Deliver vetted authentication/session handling, per-user ownership, repository-backed connections, authenticated encryption with separate versioned server key and rotation plan, rate/request limits, CSRF/origin/CSP policy and safe diagnostics before enabling credential storage or hosted API mode. Introduce PostgreSQL migrations/repositories for users and provider configuration; defer project records to M7. Custom endpoints remain disabled to avoid SSRF in MVP.

Implement one real provider adapter end to end, initially OpenAI if an eligible account/model is available. Keep model IDs configurable, catalog capabilities explicit, unknown unsupported, task assignments for all five tasks, supported parameters/presets, test latency and safe normalized provider errors. Explicit eligible fallback only when enabled. Never prefill/return stored keys. Usage metadata excludes prompts/images/secrets.

Acceptance/tests: add/edit/disable/delete/test connection, refresh catalog, configure tasks and resolve eligible models. Unit tests cover router/fallback and adapter error classes; encryption roundtrip/wrong key; cross-user denial; sanitized responses/logs; CSRF/origin/rate-limit enforcement. Mock provider network in default tests; a separately documented live smoke test is required before claiming account/provider compatibility.

## M4 — Prompt generation

Deliver prompt composer and capability/model selection preview, validated orchestration, timeout/cancellation, stale-request protection, strict structured output parsing, at most one repair call, loading/safe error states and safe generation metadata. Server resolves credentials; no credential values in generation payloads. Disclose external data sharing.

Deliver clearly labeled deterministic local demo templates for supported prompts, with honest unsupported-prompt responses. Demo uses the actual schema/runtime and supports editing; do not label it AI output.

Acceptance/tests: mocked provider valid output renders, malformed output never replaces the scene, bounded repair/cancellation/timeouts and stale results are covered. Optional manual real-provider generation confirms setup. Demo runs without credentials. Model-unavailable/capability errors identify corrective actions and never silently substitute a model.

## M5 — Refinement/history

Deliver strict allowlisted patch contract with base revision, targeted operations, explanations/IDs/warnings; validate both patch and resulting scene before application. Include selected-object context and revision. Add chat preview/acceptance, one undo transaction per accepted change, revision repository, restore-as-new-revision and deterministic supported demo refinements.

Acceptance/tests: targeted property change preserves unrelated fields; stale, invalid or destructive/ambiguous patches do not silently apply; failure preserves scene; revision restore retains later history; demo refinements are labeled. Browser checks refine → accept → undo/redo.

## M6 — Images/assets

Deliver file size/MIME/signature/dimension/parse validation, reference preview and image-capability routing, approved local GLB/GLTF imports, asset metadata/license/ownership, searchable library and missing-asset recovery. Reject network references, external GLTF dependencies and AI-provided URLs unless an explicitly approved local asset mapping resolves them. Add object storage behind an asset repository for hosted operation. Handle disposal and storage failures.

Acceptance/tests: oversized/malformed/unsupported uploads rejected; unsupported image models blocked; private asset ownership enforced; imports do not fetch arbitrary URLs; missing assets have clear repair state. Browser test valid local asset path and invalid fixtures.

## M7 — Persistence/export

Deliver project CRUD, search/sort/grid-list, duplicate/rename/confirmed delete, server revisions, optimistic version checks and local recovery on failed writes. Persist scene data and safe metadata through repositories; never credentials. Export validated scene JSON, ZIP with local assets/metadata/README/attribution, and bundled standalone HTML for supported bounded scenes. Explain format limitations; disable unsupported exports with a reason. Pin bundled dependencies, keep remote scripts off by default.

Acceptance/tests: save/reload/reopen, duplicate/delete, concurrent write conflicts and revision restore. Inspect archives for required files/assets and absence of secrets; missing assets fail clearly. Smoke-test actual output independently from the development server. Only report export success once the artifact exists.

## M8 — Hardening/demo

Deliver complete demo path, final presets, responsive/accessibility checks, focus/keyboard/reduced-motion behavior, security review, performance/resource checks, dependency scan, clean-install rehearsal and accurate deployment/retention/rotation docs. Fill any P0 gaps before taking P1 work. Validate environment in the selected hosting runtime before enabling production API.

Acceptance: lint/typecheck/unit/integration/desktop-mobile E2E/build all pass; user completes configure/test/select → generate → inspect/play → refine → undo/redo → save/reopen → export without manual database edits. Repeat with labeled demo mode and simulated provider errors. Mark `implement.md` final acceptance boxes only against evidence. Document limits rather than claiming unsupported integrations.

## Architecture decisions and change policy

- Use the conventional Node backend option from the specification; do not publish credentials on an unauthenticated scaffold.
- Keep one root dependency/lockfile set for this small workspace; introduce packages only when they contain implementation.
- M0 installs no rendering or provider SDK dependencies before those milestones need them.
- UI shell is a foundation, not a substitute for core features. Unavailable features have explicit reasons.
- Each milestone adds tests proportional to its behavior and updates the relevant documentation. Never replace useful working code merely to match a suggested directory layout.
