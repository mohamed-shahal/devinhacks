import { fileURLToPath } from 'node:url';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnv as parseDotEnv } from 'node:util';
import { defineConfig } from 'vite';
import type { UserConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { parseEnv } from '../api/src/config/env.ts';

export default defineConfig((): UserConfig => {
  const envPath = resolve(process.cwd(), '.env');
  // Parse without mutating NODE_ENV: API development settings must not turn
  // a production frontend build into a React development build.
  const fileEnv = existsSync(envPath)
    ? parseDotEnv(readFileSync(envPath, 'utf8'))
    : {};
  const env = parseEnv({ ...fileEnv, ...process.env });
  return {
    root: fileURLToPath(new URL('.', import.meta.url)),
    plugins: [react(), tailwindcss()],
    // Public configuration is intentionally empty. Server secrets cannot be exposed via VITE_.
    envPrefix: [],
    envDir: false,
    server: {
      host: new URL(env.APP_BASE_URL).hostname,
      port: Number(new URL(env.APP_BASE_URL).port || 5173),
      strictPort: true,
      proxy: { '/api': { target: env.API_BASE_URL } },
    },
    preview: { host: 'localhost', port: 4173, strictPort: true },
    build: { outDir: '../../dist/web', emptyOutDir: true },
  };
});
