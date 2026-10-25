# Security and privacy

## Current local-only mode

The API listens on loopback and only accepts local HTTP origins from the configured app URL. Mutating routes require that exact `Origin`; foreign or absent origins are rejected. CORS does not enable credentials. Request bodies are validated, requests are bounded, provider calls have timeouts, arbitrary provider endpoints are disabled, and forwarding headers are ignored for local rate limiting.

Provider keys are accepted only by the local API. The API encrypts them with AES-256-GCM using a random 32-byte key stored with restrictive file permissions under the ignored `.local` directory. The key is created on first use; database records store ciphertext; connection reads expose only a `hasCredential` flag. Requests, errors and usage records omit keys, prompts and image bytes. This protects against accidental plaintext storage and export, but does not protect against another process or person with access to the same OS account or machine. Back up or remove the `.local` directory deliberately; deleting its encryption key makes stored credentials unreadable.

Projects and imported assets stay in browser IndexedDB. A real generation request sends the prompt and, when attached, the reference image to OpenAI through the local API. Demo templates do not send data. Scene and patch schemas reject unknown fields and executable properties; no generated JavaScript is evaluated. Imported GLTF external URLs are rejected, and runtime asset loading uses local approved assets only.

## Hosted operation is blocked

This project does not yet have account authentication, per-user authorization, CSRF tokens, separate secret-manager keys, key rotation, production database migrations, or a hosted retention/deletion policy. Local credential storage is not suitable for a shared or public server. API startup with `NODE_ENV=production` remains blocked until those protections and their tests are implemented. Do not expose the local API to a network.

Before hosting, add vetted authentication and session handling, per-user data ownership, a separately managed encryption key with rotation, strict CSP and CSRF protections, production rate limiting, migration/backup procedures, dependency scanning, retention/deletion controls, and a security review of all deployment boundaries.

## Film jobs and voice

Scripts, art-direction context and narration are sent to the selected OpenAI connection. Background Responses use `store: false` but OpenAI temporarily retains response data to support polling; see [background retention](https://developers.openai.com/api/docs/guides/background). Realtime voice authentication is a server-only Authorization header to the fixed OpenAI WebSocket host. No credentials are sent to the browser or included in film jobs. The adapter bounds voice payloads/duration and redacts error messages. Cancellation closes voice generation and cancels the remote scene response when an ID is known.

Local script jobs/media use bounded process memory (one active preparation, six jobs, one-hour expiry). Refresh recovery stores only a random job ID in sessionStorage. GET job/audio routes inherit the existing loopback/origin policy; this is not multi-user authorization and hosted startup remains disabled. Discard deletes the job and cached audio; API shutdown removes the cache. Encoding accepts a bounded WebM upload, uses only server-created temporary filenames, fixed arguments, deadlines and cleanup. User/model strings never become executable commands or provider URLs.
