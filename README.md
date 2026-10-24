# SceneCraft AI

A browser-based studio for editable animated 3D scenes. The product contract is [implement.md](implement.md), copied verbatim from the supplied **Project Ideas Inventory (3).md**. Implementation follows its M0–M8 milestones.

## Current state

**M0 — audit and foundation.** The initial directory was empty: no source, Git repository, configuration or installed dependencies. See [the audit](docs/audit.md) and [milestone plan](docs/implementation-plan.md).

Implemented: responsive React application shell, Studio / Projects / Assets / AI Models / Settings routes, build-plan route, browser-local appearance preference, live API health with retry, loopback-only API, validated environment, safe API errors, strict TypeScript, lint/format/test/build tooling and CI. Future feature pages explicitly identify their milestones. This release does not generate, render, save or export scenes, and is not the finished MVP or demo mode.

## Quick start

Use **Node.js 24 LTS** (see `.nvmrc`) and npm. The workspace requires Node 22.12 or newer. Compatibility was checked against [Vite's requirements](https://vite.dev/guide/) and [Hono's Node adapter documentation](https://hono.dev/docs/getting-started/nodejs).

```sh
npm ci
cp .env.example .env
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The API runs at [http://localhost:8787/api/v1/health](http://localhost:8787/api/v1/health). The web development server proxies `/api` to the API; browser requests do not need a separate public API URL. No credentials, paid services or database are needed for M0. Copying `.env.example` is optional when using default ports.

Stop both processes with Ctrl-C. `npm run dev:web` and `npm run dev:api` run them separately. Both bind to loopback. Change `APP_BASE_URL` and `API_BASE_URL` together with their ports in `.env` if needed; restart the development processes. Origins must be local HTTP origins with no path, query or credentials.

In this workspace the ignored local `.env` uses [http://127.0.0.1:5273](http://127.0.0.1:5273) and API port 8877 because other applications already occupy the default ports. The checked-in example retains the defaults above. Automated browser tests use their own ports 5274/8878 with no server reuse.

## Verification

```sh
npm run check
npx playwright install chromium
npm run test:e2e
```

`check` runs formatting, lint, strict type checking, unit/integration tests and builds both applications. Playwright tests desktop and mobile navigation, real API connectivity, unavailable-API recovery, disabled credential entry and preference persistence. Default tests make no paid model calls. CI installs Chromium and runs both commands.

Individual commands: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run format:check`. Apply formatting with `npm run format`. The lockfile pins the resolved dependency graph; use `npm ci` for repeatable installs. `npm audit` checks known dependency vulnerabilities.

## Build and preview

```sh
npm run build
npm run preview
```

Frontend output is `dist/web`, API output is `dist/api/index.js`. Static preview runs at [http://localhost:4173](http://localhost:4173) and does not proxy the API: its status is correctly shown as offline. For the connected application use `npm run dev`. To smoke-test the built API locally, use `npm run start:api` with `NODE_ENV=development`.

**Hosted API startup with `NODE_ENV=production` is deliberately blocked in M0.** Authentication, authorization, vault encryption and credential management are prerequisites for enabling hosted operation in M3. The production frontend build is supported. See [deployment](docs/deployment.md).

## Architecture and next milestone

`apps/web` owns the UI and health client; `apps/api` owns environment validation and HTTP routes; `packages/shared` contains public contracts. Scene schema and Three.js runtime packages are added in M1. Provider code and secrets never belong in UI components or the rendering runtime.

Next: M1 implements the strict scene contract and semantic validation, raw Three.js controller with disposal, three presets, a procedural robot, playback, selection and the first inspector. Each milestone must pass its acceptance checks before the next stage is marked complete.

Documentation: [architecture](docs/architecture.md), [security](docs/security.md), [scene schema](docs/scene-schema.md), [providers](docs/providers.md), [export](docs/export.md), [demo](docs/demo-script.md).
