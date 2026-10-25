import { serve } from '@hono/node-server';
import { Server } from 'node:http';
import { createApp } from './app';
import { parseEnv } from './config/env';

try {
  const env = parseEnv(process.env);
  if (env.NODE_ENV === 'production') {
    throw new Error(
      'Hosted API startup is disabled until authentication and credential security are implemented in M3.',
    );
  }
  const url = new URL(env.API_BASE_URL);
  const server = serve(
    {
      fetch: createApp(env).fetch,
      hostname: url.hostname === '[::1]' ? '::1' : url.hostname,
      port: Number(url.port || 80),
    },
    () => {
      if (env.LOG_LEVEL !== 'silent')
        console.info(`SceneCraft API: ${url.origin}`);
    },
  );
  if (server instanceof Server) {
    server.requestTimeout = 120_000;
    server.headersTimeout = 10_000;
  }
  server.on('error', () => {
    console.error(
      'API listener failed. Check that the configured local port is available.',
    );
    process.exitCode = 1;
  });
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => {
      server.close(() => process.exit(0));
      setTimeout(() => process.exit(1), 5_000).unref();
    });
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : 'API startup failed.');
  process.exitCode = 1;
}
