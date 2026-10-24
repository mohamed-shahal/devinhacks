# Architecture

Status: M0. Conventional deployment track: static React/Vite frontend, Node/Hono API, future PostgreSQL and S3-compatible assets.

## Implemented boundaries

- `apps/web/src/app`: navigation, route composition, application shell and visible milestone state.
- `apps/web/src/api`: validated public API responses; Query owns loading/error/retry/cancellation.
- `apps/web/src/features/settings`: appearance preference, stored under `scenecraft:theme`. No credentials or scene data in storage.
- `apps/api/src/config`: server-only environment parsing, safe field-name-only errors.
- `apps/api/src/app.ts`: independently testable Hono application, request IDs, security headers, strict origin handling and versioned health route.
- `apps/api/src/index.ts`: loopback listener, production startup guard and graceful shutdown.
- `packages/shared`: public health/error contracts only. Never re-export backend config, provider SDKs or credentials here.

Current data flow: browser → same-origin `/api/v1/health` → Vite proxy → Hono → strict public response → Query → status UI. Theme changes flow only to DOM and browser storage.

Vite's public environment prefix list is empty. Its config may read server environment to configure a development proxy, but these values are not defined in browser code. Application secrets will stay exclusively in API modules.

## Planned boundaries

M1 adds pure scene domain/schema and independent raw Three.js runtime packages. UI → application services → domain/repositories; validated scene → runtime → WebGL. Rendering never calls a provider. Centralized animation time stays outside React's frame-by-frame state.

M3 adds auth, provider adapters, capability routing, server-side vault, owned repositories and safe diagnostics. M4 orchestrates provider → parse → validate → bounded repair → valid scene. M5 validates revision-bound patches as one undo action. M7 adds project/revision persistence and asset-aware export. See the milestone plan for acceptance gates.
