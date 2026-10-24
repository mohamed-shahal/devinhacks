import { describe, expect, it } from 'vitest';
import { healthSchema } from '@scenecraft/shared';
import { createApp } from './app';
import { parseEnv } from './config/env';

describe('API foundation', () => {
  const app = createApp(parseEnv({}));
  it('returns validated health without private config', async () => {
    const response = await app.request('/api/v1/health');
    expect(response.status).toBe(200);
    expect(healthSchema.parse(await response.json()).mode).toBe(
      'local-foundation',
    );
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('x-request-id')).toBeTruthy();
  });
  it('allows only the configured browser origin', async () => {
    const response = await app.request('/api/v1/health', {
      headers: { Origin: 'http://localhost:5173' },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBe(
      'http://localhost:5173',
    );
    expect(response.headers.get('access-control-allow-credentials')).toBeNull();
  });
  it('rejects a foreign origin', async () => {
    const response = await app.request('/api/v1/health', {
      headers: { Origin: 'https://untrusted.example' },
    });
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      error: { code: 'FORBIDDEN', requestId: expect.any(String) },
    });
  });
  it('does not expose unimplemented provider mutations', async () => {
    const response = await app.request('/api/v1/provider-connections', {
      method: 'POST',
    });
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({
      error: { code: 'NOT_FOUND', requestId: expect.any(String) },
    });
  });
  it('sanitizes unexpected exceptions', async () => {
    const errorApp = createApp(parseEnv({}));
    errorApp.get('/api/v1/test-error', () => {
      throw new Error('private-provider-key');
    });
    const response = await errorApp.request('/api/v1/test-error');
    expect(response.status).toBe(500);
    const body = await response.text();
    expect(body).not.toContain('private-provider-key');
    expect(JSON.parse(body)).toMatchObject({
      error: { code: 'INTERNAL_ERROR' },
    });
  });
});
