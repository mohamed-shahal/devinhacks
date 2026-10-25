# Milestone implementation plan

The scope and ordering below derive from `implement.md` sections 2, 17 and 22. P0 comes before P1; P2 stays deferred. A milestone is complete only when its runnable application behavior and listed checks pass. Update this document with evidence and deviations at each stage, rather than marking the final product checklist early.

The 2026-10-25 video-first product direction supersedes the old scene-editor-first acceptance path. The primary flow is OpenAI structured scene generation followed by local Three.js video rendering; Runway is optional. M0–M8 document the retained scene-editor foundation; M9 records the optional Runway adapter; M10 implements local scene-to-video rendering; M11 makes OpenAI scene planning a required, recommended-model-first part of the primary Studio. Scene tools remain accessible at `/scene-editor` and should not be removed unnecessarily.

## Status

| Milestone                 | Status                                                            | Dependency           |
| ------------------------- | ----------------------------------------------------------------- | -------------------- |
| M0 Audit and foundation   | Complete                                                          | None                 |
| M1 Schema and renderer    | Implemented, verifying                                            | M0                   |
| M2 Studio                 | Implemented, verifying                                            | M1                   |
| M3 AI Models              | Local-only MVP                                                    | M0, M2 integration   |
| M4 Prompt generation      | Implemented, verifying                                            | M1–M3                |
| M5 Refinement/history     | Local demo + restore implemented; verify                          | M2, M4               |
| M6 Images/assets          | Local placement implemented; verify                               | M1, M3–M5            |
| M7 Persistence/export     | Local formats implemented; verify                                 | M1–M6                |
| M8 Hardening/demo         | In progress                                                       | All prior milestones |
| M9 Optional Runway video  | Automated provider tests passed; live paid smoke pending          | M0, M3               |
| M10 Three.js video render | Implemented; browser capture verified; API restart needed for MP4 | M0, M2, M5           |
| M11 OpenAI scene planning | Implemented; model configured, live generation smoke pending      | M3, M4, M10          |

## M0 — Audit and foundation

Deliver: preserve/copy the supplied specification, record the initial audit, establish npm workspaces (`apps/web`, `apps/api`, `packages/shared`), React/Vite, strict TypeScript, Tailwind, React Router, Query, Zod and Hono. Add formatting, lint, Vitest/Testing Library, Playwright, CI, environment validation, `.env.example`, ignored secret files and documentation. Add real navigation, appearance preference and live health status; future scene tools must be clearly unavailable.

Acceptance: fresh install starts locally; health responds over HTTP; all five routes work on desktop/mobile; settings persist; API failure and retry work; invalid environment fails safely; foreign origins are rejected; API errors do not reveal internal details; typecheck/lint/tests/build pass. No secrets or credential entry, and no claim of scene generation. Verify built API, production guard and static frontend separately.

Verification on 2026-10-25: formatting, lint, strict typecheck, 19 unit/integration tests, production web/API builds and four Playwright tests passed (two flows each on desktop and mobile). The connected local app was visually inspected. Built-artifact/startup and dependency-scan evidence is recorded in `docs/verification.md`. Tests use dedicated loopback ports 5274/8878 and never attach to an unrelated running server. The local `.env` uses 5273/8877 because this machine already has services on the documented defaults; it contains no secrets and is ignored.

## M1 — Schema and renderer

Implementation update (2026-10-25): strict Zod scene and patch schemas, deterministic presets, validated update boundary, raw Three.js renderer, procedural primitives/robot/tree/building/particles, lighting, orbit controls, selection, timeline playback and disposal are implemented. Four focused schema/patch tests were added. Browser verification and runtime edge-case coverage remain part of M8; do not call this acceptance complete yet.

Deliver `packages/scene-schema` with a versioned, strict Zod contract, stable IDs and semantic validators, plus `packages/scene-runtime` using raw Three.js. Define bounded allowlists for object/material/light/animation types. Validate duplicate IDs, parent existence/cycles, finite values, transforms, counts, duration, colors, animation references and approved asset IDs. Establish pure migration policy before additional schema versions.

Runtime owns mount/update/applyPatch/play/pause/reset/seek/quality/resize/dispose; renderer consumes validated data only. Build factories for required primitives, groups, procedural robot with limb pivots, trees/buildings and bounded emitters. Add perspective camera/orbit controls, selection and basic inspector. Implement at least cyberpunk, forest and abstract presets through the same schema. Finish all five environment presets by M8. Unsupported asset imports stay unavailable until M6.

Acceptance/tests: each preset validates and renders; invalid input preserves the current scene; play/pause/reset/seek behave predictably; pixel ratio/lights/particles are capped; resize/context loss/unsupported WebGL are handled; unmount disposes resources and listeners. Unit tests cover malicious/invalid schemas and centralized animation evaluation; browser checks render presets and selection without paid calls.

## M2 — Studio

Deliver desktop panels and mobile drawers/tabs, hierarchy, object transform/material/visibility inspector, duplicate/delete/frame, timeline and track controls, playback speed/loop, bounded immutable undo/redo, grouped edits, save status and validated browser-local draft recovery. Use an application service/repository seam for drafts so M7 can add server persistence. No provider calls in renderer.

Acceptance/tests: a user can build/edit/play a scene without AI; undo/redo restores both scene and runtime; recovery survives refresh; corrupted or old recovery data has a safe failure/migration path; failed storage preserves in-memory edits. Add integration and browser tests for transforms, history, playback and reload. Do not mark a draft as server-saved.

## M3 — AI Models

Implementation update (2026-10-25): a local-only OpenAI adapter, catalog refresh, explicit capability configuration, task assignments, encrypted machine-local credential storage, provider test and safe usage metadata are implemented. The connection is intentionally unavailable in production: user authentication, per-user authorization, server-managed key rotation, PostgreSQL migrations and hosted deployment gates remain unimplemented. Do not treat local AES-GCM storage as a hosted credential vault.

Deliver vetted authentication/session handling, per-user ownership, repository-backed connections, authenticated encryption with separate versioned server key and rotation plan, rate/request limits, CSRF/origin/CSP policy and safe diagnostics before enabling credential storage or hosted API mode. Introduce PostgreSQL migrations/repositories for users and provider configuration; defer project records to M7. Custom endpoints remain disabled to avoid SSRF in MVP.

Implement one real provider adapter end to end, initially OpenAI if an eligible account/model is available. Keep model IDs configurable, catalog capabilities explicit, unknown unsupported, task assignments for all five tasks, supported parameters/presets, test latency and safe normalized provider errors. Explicit eligible fallback only when enabled. Never prefill/return stored keys. Usage metadata excludes prompts/images/secrets.

Acceptance/tests: add/edit/disable/delete/test connection, refresh catalog, configure tasks and resolve eligible models. Unit tests cover router/fallback and adapter error classes; encryption roundtrip/wrong key; cross-user denial; sanitized responses/logs; CSRF/origin/rate-limit enforcement. Mock provider network in default tests; a separately documented live smoke test is required before claiming account/provider compatibility.

## M4 — Prompt generation

Implementation update (2026-10-25): deterministic labeled demo generation and structured OpenAI scene generation are implemented. The scene is schema-validated before replacing editor state. Provider generation requires an explicit configured OpenAI connection and capability assignment. Cancellation, stale-request protection and a single automated repair attempt are not implemented.

Deliver prompt composer and capability/model selection preview, validated orchestration, timeout/cancellation, stale-request protection, strict structured output parsing, at most one repair call, loading/safe error states and safe generation metadata. Server resolves credentials; no credential values in generation payloads. Disclose external data sharing.

Deliver clearly labeled deterministic local demo templates for supported prompts, with honest unsupported-prompt responses. Demo uses the actual schema/runtime and supports editing; do not label it AI output.

Acceptance/tests: mocked provider valid output renders, malformed output never replaces the scene, bounded repair/cancellation/timeouts and stale results are covered. Optional manual real-provider generation confirms setup. Demo runs without credentials. Model-unavailable/capability errors identify corrective actions and never silently substitute a model.

## M5 — Refinement/history

Implementation update (2026-10-25): structured targeted patch generation, revision checks, schema validation before preview, explicit accept/discard, editor undo/redo, deterministic demo refinements for height, animation speed and rain, and a restore-as-new-revision control are implemented. Live provider refinement and full revision-history browser verification remain dependent on a configured provider/browser run.

Deliver strict allowlisted patch contract with base revision, targeted operations, explanations/IDs/warnings; validate both patch and resulting scene before application. Include selected-object context and revision. Add chat preview/acceptance, one undo transaction per accepted change, revision repository, restore-as-new-revision and deterministic supported demo refinements.

Acceptance/tests: targeted property change preserves unrelated fields; stale, invalid or destructive/ambiguous patches do not silently apply; failure preserves scene; revision restore retains later history; demo refinements are labeled. Browser checks refine → accept → undo/redo.

## M6 — Images/assets

Implementation update (2026-10-25): browser-side image signature/dimension/size validation, optional reference-image routing, local asset library, self-contained GLB/GLTF parse validation and scene placement/rendering are implemented. Server validation rejects AI references to unapproved local asset IDs; assets in use cannot be deleted. Browser verification with a real model fixture and image preview-to-prompt handoff remain.

Deliver file size/MIME/signature/dimension/parse validation, reference preview and image-capability routing, approved local GLB/GLTF imports, asset metadata/license/ownership, searchable library and missing-asset recovery. Reject network references, external GLTF dependencies and AI-provided URLs unless an explicitly approved local asset mapping resolves them. Add object storage behind an asset repository for hosted operation. Handle disposal and storage failures.

Acceptance/tests: oversized/malformed/unsupported uploads rejected; unsupported image models blocked; private asset ownership enforced; imports do not fetch arbitrary URLs; missing assets have clear repair state. Browser test valid local asset path and invalid fixtures.

## M7 — Persistence/export

Implementation update (2026-10-25): browser-local project create/open/duplicate/rename/delete/import, autosave, JSON export, ZIP archives with only referenced local assets, revision restore-as-new-revision and self-contained offline HTML export for procedural scenes are implemented. Server project persistence, thumbnails in project cards and standalone export of imported-model scenes remain incomplete.

Deliver project CRUD, search/sort/grid-list, duplicate/rename/confirmed delete, server revisions, optimistic version checks and local recovery on failed writes. Persist scene data and safe metadata through repositories; never credentials. Export validated scene JSON, ZIP with local assets/metadata/README/attribution, and bundled standalone HTML for supported bounded scenes. Explain format limitations; disable unsupported exports with a reason. Pin bundled dependencies, keep remote scripts off by default.

Acceptance/tests: save/reload/reopen, duplicate/delete, concurrent write conflicts and revision restore. Inspect archives for required files/assets and absence of secrets; missing assets fail clearly. Smoke-test actual output independently from the development server. Only report export success once the artifact exists.

## M8 — Hardening/demo

Verification update (2026-10-25): formatting, lint, strict typecheck, 32 unit/integration tests, production builds and desktop/mobile Playwright checks pass. E2E now exercises deterministic demo refinement, review/apply/undo/redo and both JSON and standalone HTML downloads. Remaining release gates: test a live provider connection with a user-supplied key, exercise a real GLB fixture end-to-end, complete accessibility/security review, and implement authentication/authorization/key rotation/migrations before any hosted API deployment.

Deliver complete demo path, final presets, responsive/accessibility checks, focus/keyboard/reduced-motion behavior, security review, performance/resource checks, dependency scan, clean-install rehearsal and accurate deployment/retention/rotation docs. Fill any P0 gaps before taking P1 work. Validate environment in the selected hosting runtime before enabling production API.

Acceptance: lint/typecheck/unit/integration/desktop-mobile E2E/build all pass; user completes configure/test/select → generate → inspect/play → refine → undo/redo → save/reopen → export without manual database edits. Repeat with labeled demo mode and simulated provider errors. Mark `implement.md` final acceptance boxes only against evidence. Document limits rather than claiming unsupported integrations.

## M9 — Optional Runway video output

Direction update: replace the default editable-world experience with a real video deliverable. Preserve the existing Three.js editor as a separate legacy route. Current implementation adds a story brief, editable/reorderable 3–5 camera shots (angle, movement, action), random distinct angle/movement selection with reshuffle, manual per-shot direction, duration/frame/audio controls, a real-provider setup path, asynchronous progress, a video player and MP4 download. The API integrates Runway's version-pinned custom multi-shot recipe, stores only the provider task reference, polls status and proxies the temporary output URL without exposing it to the browser.

Verification update (2026-10-25): provider-mocked endpoint/security tests, responsive desktop/mobile E2E coverage, full formatting/lint/typecheck/tests/build, and live video-first UI inspection passed. The no-provider state is explicit and actionable, and no sample storyboard is represented as generated footage. A live paid provider smoke test remains outstanding until the user configures their own Runway key. Do not fake a finished render when no connection exists.

## M10 — Local Three.js video render (current primary renderer)

Use the existing Three.js runtime to render animated frames; the Studio camera shot list controls per-cut angle and movement, and canvas recording produces playable video with progress. Video rendering itself works without Runway credentials. OpenAI scene planning is required for the primary Studio (see M11). The API uses a bounded fixed-argument FFmpeg call to encode MP4, with WebM fallback. Automated checks cover app flow, invalid transcode payloads and the FFmpeg conversion helper. The current browser-to-MP4 path, exact HD dimensions and AAC narration are live-verified in M12; see docs/verification.md.

## M11 — Required OpenAI scene planning

Product clarification: the primary Studio now requires an OpenAI-generated, schema-valid scene; it no longer falls back to a local procedural scene. Automatic routing prefers GPT-6.1 Sol when available and eligible, with configurable compatible OpenAI models as alternatives. The UI surfaces setup guidance and the active model. AI Models marks GPT-6.1 Sol as recommended and preselects its documented text/Structured Outputs capabilities when selected from the catalog. The model catalog has now been loaded through the configured local OpenAI connection, and GPT-6.1 Sol is assigned to Scene planning. Three.js renders the validated OpenAI output unchanged as the source scene for cinematic camera shots. Default automated checks make no paid model calls. M12 now includes a successful live OpenAI two-scene generation, Realtime narration and Three.js MP4 export; see docs/verification.md.

## Architecture decisions and change policy

- Use the conventional Node backend option from the specification; do not publish credentials on an unauthenticated scaffold.
- Keep one root dependency/lockfile set for this small workspace; introduce packages only when they contain implementation.
- M0 installs no rendering or provider SDK dependencies before those milestones need them.
- UI shell is a foundation, not a substitute for core features. Unavailable features have explicit reasons.
- Each milestone adds tests proportional to its behavior and updates the relevant documentation. Never replace useful working code merely to match a suggested directory layout.

## M12 — Script films, narration and resilient preparation

Deliver script/brief modes (12,000 characters, twelve sections, ten-minute limit), compact validated scene generation per section, deliberate art direction and subject-aware cinematic cameras at 720p/1080p. Preparation returns a local job ID, uses OpenAI background Responses with an eight-minute per-scene deadline, polls the same response across transient failures and cancels it on request. Completed scene/audio stages survive retries and browser refresh while the local API remains running. A failed audio stage reuses the completed scene.

Generate actual server-side Realtime narration with configurable `gpt-realtime-2.1-mini`/`gpt-realtime-2.1` and built-in Marin/Cedar/Coral voices. Buffer bounded 24 kHz mono PCM, measure speech duration, pad scene timelines and encode AAC + H.264 MP4 with fixed FFmpeg arguments. The UI separates Prepare → review scenes/audio → Render, offers cancellation/retry, and keeps the captured WebM for encoding retry. Audio-enabled export never silently drops speech. No music generation, lip sync or voice cloning is claimed.

Verification is recorded in docs/verification.md. Keep tests for long-running response polling, cancellation, original script coverage/order, scene/audio checkpoint retry, PCM-to-WAV assembly, actual AAC muxing when FFmpeg is installed, and desktop/mobile script/retry/reload UI. Current job cache is process-local and expires after one hour; durable background queues and hosted auth remain outside this local milestone.
