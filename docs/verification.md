# M0 verification

Date: 2026-10-25. Runtime: Node 25.2.1 / npm 11.6.2 on macOS. CI targets Node 24 LTS; the CI workflow is configured but has not been run remotely.

- Formatting, ESLint with zero warnings and strict TypeScript: passed.
- Vitest: 19 tests passed across four files (environment validation, API headers/origin/error handling, health response validation, navigation/settings).
- Playwright: four tests passed across desktop Chromium and mobile Chromium emulation. Tests cover all navigation routes, actual API health, failed health/retry, persisted theme and disabled credential entry. These are foundation checks, not the unfinished product's final E2E suite.
- Frontend and Node API builds: passed. Server environment is parsed without mutating Vite's build mode; API `NODE_ENV=development` in `.env` must not ship React development code.
- Built-output smoke tests: API health responds from `dist/api/index.js`; static preview serves the SPA `/settings` route and its hashed JavaScript asset; production API startup exits with code 1; invalid configuration exits without revealing its value. Temporary smoke-test processes were stopped.
- Public artifact inspection: a build with synthetic values in both `VITE_SECURITY_TEST` and server secret fields contains none of the synthetic value in its frontend files. React development-runtime markers are absent. No real credentials were used in this check.
- Local visual review: Studio shell renders correctly in the app's browser; viewport area explicitly states renderer availability in M1.
- Final `npm audit --audit-level=low`: zero vulnerabilities. Lockfile pins resolved stable versions.
- No provider calls, credentials, database or paid service required.

The first browser attempt encountered another app on port 5173 and was rejected as a valid result. Tests now use dedicated 127.0.0.1 ports 5274 (web) and 8878 (API), with server reuse disabled. Current local preview uses ignored, non-secret `.env` ports 5273/8877. Existing services were left running.

The Node 25 host's native storage global initially interfered with jsdom tests. Test setup explicitly uses jsdom's actual Storage. Browser tests independently verify persistence. No application storage mock was substituted.

Remaining milestones M1–M8 are not implemented or verified. No hosted-security or complete-MVP claim is made.
