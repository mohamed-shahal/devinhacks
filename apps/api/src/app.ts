import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { requestId } from 'hono/request-id';
import { secureHeaders } from 'hono/secure-headers';
import type { ApiError, Health } from '@scenecraft/shared';
import type { Env } from './config/env';

export function createApp(env: Env) {
  const app = new Hono();
  app.use('*', requestId());
  app.use('*', secureHeaders());
  app.use(
    '/api/*',
    cors({
      origin: env.APP_BASE_URL,
      allowMethods: ['GET'],
      credentials: false,
    }),
  );
  app.use('/api/*', async (c, next) => {
    c.header('Cache-Control', 'no-store');
    const origin = c.req.header('Origin');
    if (origin && origin !== env.APP_BASE_URL) {
      return c.json(
        {
          error: {
            code: 'FORBIDDEN',
            message: 'Origin is not allowed.',
            requestId: c.get('requestId'),
          },
        } satisfies ApiError,
        403,
      );
    }
    await next();
  });
  app.get('/api/v1/health', (c) =>
    c.json({
      status: 'ok',
      service: 'scenecraft-api',
      milestone: 'M0',
      mode: 'local-foundation',
    } satisfies Health),
  );
  app.notFound((c) =>
    c.json(
      {
        error: {
          code: 'NOT_FOUND',
          message: 'This API route is not available.',
          requestId: c.get('requestId'),
        },
      } satisfies ApiError,
      404,
    ),
  );
  app.onError((_error, c) =>
    c.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'The request could not be completed.',
          requestId: c.get('requestId'),
        },
      } satisfies ApiError,
      500,
    ),
  );
  return app;
}
