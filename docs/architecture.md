# Architecture

Status: local-only, video-first MVP. Conventional deployment track: static React/Vite frontend and Node/Hono API. Hosted credential handling and user-owned storage remain disabled.

## Implemented boundaries

- `apps/web/src/app`: video-first navigation, route composition and application shell.
- `apps/web/src/features/video`: brief/script input, 3–5 directed shots, voice/output settings, preparation review, progress, MP4 preview and download.
- `apps/web/src/services/video-render.ts`: validated scene input → Three.js render runtime → browser canvas capture → downloadable WebM.
- `apps/web/src/api`: same-origin JSON APIs; the browser never receives provider keys or signed output URLs.
- `apps/web/src/features/settings`: appearance preference, stored under `scenecraft:theme`. No credentials or scene data in storage.
- `apps/api/src/config`: server-only environment parsing, safe errors.
- `apps/api/src/providers/runway.ts`: optional pinned Runway multi-shot request, task polling and allowlisted temporary output retrieval.
- `apps/api/src/routes.ts`: validated scene/model routing and optional provider job routes.
- `apps/api/src/app.ts`: independently testable Hono application, request IDs, security headers and strict origin handling.
- `apps/api/src/index.ts`: loopback listener, production startup guard and graceful shutdown.
- `packages/shared`: public health/error contracts only. Never re-export backend config, provider SDKs or credentials here.

Current primary video flow: script → asynchronous OpenAI structured scene planning and optional Realtime narration → server-side scene validation → scene/audio review → `SceneRuntime` animates each scene with directed camera cuts → `canvas.captureStream()` and `MediaRecorder` produce the picture recording → a bounded local FFmpeg route combines it with scene-aligned narration as MP4. Encoding failure preserves the recording for retry. Automatic scene planning prefers GPT-6.1 Sol when configured, or another eligible OpenAI model. The Studio requires a configured scene planner; it never silently substitutes a local template. Runway remains an optional separate path. Provider keys never enter the browser renderer.

Vite's public environment prefix list is empty. Its config may read server environment to configure a development proxy, but provider secrets stay exclusively in API modules.

## Planned boundaries

The previous scene domain/schema and raw Three.js runtime remain for `/scene-editor`. UI → application services → domain/repositories; validated scene → runtime → WebGL. Rendering never calls a provider.

Hosted deployment still needs authentication, per-user authorization, managed key rotation, durable job/media storage, retention and production operations. Local recording requires a browser with WebGL and MediaRecorder support; MP4 conversion also requires FFmpeg on the local API host. See [providers](providers.md), [export](export.md) and the [milestone plan](implementation-plan.md).

### Script-film pipeline

`filmInputSchema` bounds the script, output settings and shot directions. `splitFilmScript` preserves ordered script text and sections. `/films` resolves the scene model and enabled vault connection, starts `FilmJobs` and returns HTTP 202 immediately. FilmJobs checkpoints compact OpenAI scene data and measured Realtime narration separately, expands/validates the existing Scene contract and exposes progress plus complete segments through `/films/:id`. Cancellation reaches provider polling and WebSocket generation. Retry starts at the first unfinished stage; completed scenes and audio do not incur another generation call.

The browser reviews the scene/narration list and uses `renderFilmVideo` to switch the single SceneRuntime between segments on a shared timeline. Camera cuts use a clamped monotonic clock and subject bounds. Rendering remains independent of provider calls. `/films/:id/encode` reads the browser's WebM plus this job's PCM narration, pads/aligns the audio at scene boundaries and calls the bounded fixed-argument FFmpeg encoder. No model-supplied filesystem paths or URLs reach FFmpeg. Actual audio duration determines minimum scene length. Jobs/audio remain in bounded process memory; only the active job identifier is kept in sessionStorage for refresh recovery.
