# Security and privacy

## Current M0 behavior

The API exposes only `GET /api/v1/health`. There is no credential entry/storage, model request, upload, project write or authentication claim. Both listeners bind to loopback; validated configuration accepts only local HTTP origins. The API rejects foreign browser origins and exposes no credentialed CORS. Requests without Origin can read the public local health route; this is not authentication.

Responses include request IDs, no-store and Hono security headers. Exceptions return fixed safe messages without raw exceptions or environment values. No request-body logging is installed. `NODE_ENV=production` blocks API startup until M3 implements hosted protections.

Only the selected theme persists in browser storage; it remains until browser site data is cleared. No prompts/images/keys are collected. The app contacts its own local health route, with a five-second client timeout. No AI provider is contacted. Assets and provider endpoints are absent.

`.env` and `.env.*` are ignored except the placeholder `.env.example`. No server variable uses `VITE_`; Vite's `envPrefix` is empty. Keep API configuration/server imports out of web source and shared public contracts. Public bundles must be inspected before enabling any credential integration.

## M3 gate and later work

Implement vetted authentication, secure sessions, CSRF protection, record ownership, validation, quotas/rate limiting, timeouts, strict production CORS and suitable CSP before enabling credential operations. Provider keys must use vetted authenticated encryption with a separate secret-manager key, documented key version/rotation and wrong-key failure tests. No encryption key is needed or consumed by M0; its future format will be documented with the selected vault implementation. Never return/prefill raw keys or accept keys in generation requests.

Treat prompts, images, model data, imported files and metadata as untrusted. Strict scene/patch schemas reject executable fields; no arbitrary generated JavaScript. Custom provider endpoints remain disabled for MVP. Upload/import validation must prevent arbitrary URL loading. Hosted retention/deletion policies must be documented with the repositories before launch. This foundation is not a security-complete hosted product.
