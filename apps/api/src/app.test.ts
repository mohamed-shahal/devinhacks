import { afterEach, describe, expect, it, vi } from 'vitest';
import { healthSchema } from '@scenecraft/shared';
import { createApp } from './app';
import { parseEnv } from './config/env';
import { makeObject, preset } from '@scenecraft/scene-schema';

afterEach(() => vi.unstubAllGlobals());

describe('API foundation', () => {
  const app = createApp(parseEnv({}));
  it('returns validated health without private config', async () => {
    const response = await app.request('/api/v1/health');
    expect(response.status).toBe(200);
    expect(healthSchema.parse(await response.json()).mode).toBe('local-only');
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
  it('validates provider mutations before storing credentials', async () => {
    const response = await app.request('/api/v1/provider-connections', {
      method: 'POST',
      headers: { Origin: 'http://localhost:5173' },
    });
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({
      error: { code: 'VALIDATION_ERROR', requestId: expect.any(String) },
    });
  });
  it('rejects browser mutations without the exact configured origin', async () => {
    const response = await app.request('/api/v1/provider-connections', {
      method: 'POST',
      headers: { Origin: 'https://untrusted.example' },
    });
    expect(response.status).toBe(403);
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
  it('rejects scene references to local assets not approved by the server', async () => {
    const scene = preset('Neon robot');
    const model = makeObject('asset', 'unapproved model');
    model.properties.assetId = 'asset_external';
    scene.objects.push(model);
    const response = await app.request('/api/v1/scenes/validate', {
      method: 'POST',
      headers: {
        Origin: 'http://localhost:5173',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(scene),
    });
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({
      error: { code: 'SCENE_VALIDATION_FAILED' },
    });
  });
  it('rejects incomplete video shot lists before making a provider request', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const response = await app.request('/api/v1/videos/generate', {
      method: 'POST',
      headers: {
        Origin: 'http://localhost:5173',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        connectionId: 'missing',
        story: 'A moonlit train crosses the desert.',
        duration: 10,
        ratio: '16:9',
        audio: true,
        shots: [
          {
            angle: 'Wide',
            movement: 'Crane down',
            action: 'Reveal the landscape.',
          },
          { angle: 'Close', movement: 'Dolly in', action: 'Show the train.' },
        ],
      }),
    });
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({
      error: { code: 'VALIDATION_ERROR' },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('does not reveal unknown provider video job identifiers', async () => {
    const response = await app.request('/api/v1/videos/not-a-job');
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({
      error: { code: 'NOT_FOUND' },
    });
  });
  it('validates local video transcoding input before invoking ffmpeg', async () => {
    const response = await app.request('/api/v1/videos/transcode', {
      method: 'POST',
      headers: {
        Origin: 'http://localhost:5173',
        'Content-Type': 'video/webm',
      },
      body: new Uint8Array([0, 1, 2, 3]),
    });
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({
      error: { code: 'VIDEO_TRANSCODE_FAILED' },
    });
  });
});
