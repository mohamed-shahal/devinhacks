import { afterEach, describe, expect, it, vi } from 'vitest';
import { getHealth } from './health';

afterEach(() => vi.unstubAllGlobals());

describe('health client', () => {
  it('rejects non-health JSON rather than claiming connectivity', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: 'ok' }))),
    );
    await expect(getHealth()).rejects.toThrow('unexpected health response');
  });
  it('returns a safe error for a failed request', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response('internal-server-detail', { status: 500 }),
        ),
    );
    await expect(getHealth()).rejects.toThrow(
      'The local API could not be reached.',
    );
  });
});
