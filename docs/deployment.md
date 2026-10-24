# Deployment

## M0 local operation

Selected track is conventional Node/Hono with a static React/Vite frontend. No service has been deployed. Use Node 24 LTS and `npm ci`, then `npm run dev` for the connected app. No database or object store is required. Builds produce `dist/web` and `dist/api/index.js`.

`npm run preview` serves the built frontend at localhost:4173. It does not proxy an API, so an offline API indicator in this preview is expected. `npm run start:api` can smoke-test the built API with local development configuration; do not expose it to the network. Startup under `NODE_ENV=production` intentionally fails until hosted security lands in M3.

Environment fields: `NODE_ENV` is development/test/production; `APP_BASE_URL` defaults to http://localhost:5173; `API_BASE_URL` defaults to http://localhost:8787; `LOG_LEVEL` is silent/error/warn/info/debug. Origin fields accept local HTTP origins only. Secret/database placeholders are reserved and unused. `.env` is loaded by the API runner and Vite configuration; production secrets must never become browser environment variables.

## Hosting prerequisites

M3 must implement and verify auth, ownership, encrypted vault, secret-manager configuration, CSP, origin/CSRF controls, rate limits and safe diagnostics before removing the production guard. Use PostgreSQL repositories/migrations and S3-compatible storage when those features land. Add readiness probes for required dependencies then; current health indicates only that the M0 process responds.

Future frontend hosting needs SPA fallback to `index.html`, immutable hashed assets, appropriate CSP/security headers and same-origin `/api/v1` reverse proxy. Production setup/migrations/backups/rotation/recovery instructions will be added alongside working hosted components. Do not claim the current scaffold is production deployable.
