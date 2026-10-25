# SceneCraft AI

Repository: **devinhacks**.

A browser-based cinematic video studio. Write a story, direct a sequence of camera angles and movements, and render a finished animated video locally with Three.js. The current product contract is [implement.md](implement.md); the scene editor remains available separately at `/scene-editor`.

## Current state

The initial directory was empty. See [the audit](docs/audit.md) and [milestone plan](docs/implementation-plan.md) for current status and remaining hosted-deployment work.

The primary Studio uses OpenAI to generate validated animated scenes from a brief or long script, then renders the complete film through Three.js. GPT-6.1 Sol is the recommended scene planner; users can assign another compatible OpenAI model. Direct 3–5 camera shots per scene, choose 720p/1080p and an optional AI narrator, review the prepared scenes/audio, and export an MP4. Scripts support up to 12,000 characters, twelve scenes and ten minutes. Background preparation, cancellation and stage-specific retry keep completed work while the local API remains running. A configured OpenAI connection is required; audio uses additional OpenAI usage. Runway remains optional. The separate scene editor remains at `/scene-editor`. This is local-only: account authentication and per-user authorization are not implemented, so production API startup remains blocked. See [providers](docs/providers.md), [export](docs/export.md), [security](docs/security.md) and [deployment](docs/deployment.md).

## Quick start

Use **Node.js 24 LTS** (see `.nvmrc`) and npm. The workspace requires Node 22.12 or newer. Compatibility was checked against [Vite's requirements](https://vite.dev/guide/) and [Hono's Node adapter documentation](https://hono.dev/docs/getting-started/nodejs).

```sh
npm ci
cp .env.example .env
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The API runs at [http://localhost:8787/api/v1/health](http://localhost:8787/api/v1/health). The web development server proxies `/api` to the API. Connect an OpenAI API key in AI Models, load the model catalog, configure GPT-6.1 Sol for text and structured output, and assign it to Scene planning. The key stays in the local API vault; scene prompts are sent to OpenAI and returned scene data is validated before Three.js renders it. Copying `.env.example` is optional when using default ports.

Stop both processes with Ctrl-C. `npm run dev:web` and `npm run dev:api` run them separately. Both bind to loopback. Change `APP_BASE_URL` and `API_BASE_URL` together with their ports in `.env` if needed; restart the development processes. Origins must be local HTTP origins with no path, query or credentials.

In this workspace the ignored local `.env` uses [http://127.0.0.1:5273](http://127.0.0.1:5273) and API port 8877 because other applications already occupy the default ports. The checked-in example retains the defaults above. Automated browser tests use their own ports 5274/8878 with no server reuse.

## Verification

```sh
npm run check
npx playwright install chromium
npm run test:e2e
```

`check` runs formatting, lint, strict type checking, unit/integration tests and builds both applications. Browser tests use local demo/configuration flows and make no paid model calls. CI installs Chromium and runs both commands.

Individual commands: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run format:check`. Apply formatting with `npm run format`. The lockfile pins the resolved dependency graph; use `npm ci` for repeatable installs. `npm audit` checks known dependency vulnerabilities.

## Build and preview

```sh
npm run build
npm run preview
```

Frontend output is `dist/web`, API output is `dist/api/index.js`. Static preview runs at [http://localhost:4173](http://localhost:4173) and does not proxy the API: its status is correctly shown as offline. For the connected application use `npm run dev`. To smoke-test the built API locally, use `npm run start:api` with `NODE_ENV=development`.

**Hosted API startup with `NODE_ENV=production` remains deliberately blocked.** Authentication, authorization, server-managed key rotation, production CSP/CSRF review and database migrations are not complete. The production frontend build is supported. See [deployment](docs/deployment.md).

## Architecture and next milestone

`apps/web` owns the video storyboard, Three.js render capture and preview UI; `apps/api` owns optional encrypted provider credentials and task handling. The validated scene schema and runtime power both cinematic video output and the separate scene editor. See the [architecture](docs/architecture.md).

Documentation: [architecture](docs/architecture.md), [security](docs/security.md), [scene schema](docs/scene-schema.md), [providers](docs/providers.md), [export](docs/export.md), [demo](docs/demo-script.md).

### Long scripts and narrated films

In Video Studio, choose **A long script**, paste the script (up to 12,000 characters), select camera directions, HD/Full HD and a narrator, then **Prepare scenes & narration**. Explicit `SCENE 1`, `INT.` and `EXT.` headings help split locations. Review the generated scene list and listen to narration, then **Render prepared film**. The app prepares up to twelve scenes within a ten-minute total; shorter chapters are faster to iterate. OpenAI creates validated stylized 3D scene data and speech, and Three.js renders every frame. Narration is embedded in the downloaded MP4 by FFmpeg. A single narrator is supported; music, lip sync and voice cloning are not.

Scene requests run in the background with progress, cancel and retry. Completed scene/audio work is reused after an error or page refresh while the API remains running. The local cache expires after one hour and is cleared on API restart; download finished films. Voice generation uses the existing OpenAI connection and incurs additional provider audio usage. FFmpeg is required for narrated MP4; choose Silent to omit voice. See [providers](docs/providers.md) for retention, access and model details.
