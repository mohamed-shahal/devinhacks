import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRunwayMultiShot, downloadRunwayVideo } from './runway';

const taskId = '497f6eca-6276-4993-bfeb-53cbbbba6f08';
afterEach(() => vi.unstubAllGlobals());

describe('Runway video provider', () => {
  it('submits a version-pinned custom multi-shot request with the key server-side', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ id: taskId }), { status: 200 }),
      );
    vi.stubGlobal('fetch', fetchMock);
    const id = await createRunwayMultiShot('key_private', {
      prompt: 'A moonlit train crosses a desert.',
      shots: [
        { prompt: 'Wide moonlit desert, slow crane down.', duration: 4 },
        { prompt: 'Low angle train, dolly in.', duration: 3 },
        { prompt: 'Close-up sparks, orbit left.', duration: 3 },
      ],
      duration: 10,
      ratio: '1280:720',
      audio: true,
    });
    expect(id).toBe(taskId);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      'https://api.dev.runwayml.com/v1/recipes/multi_shot_video',
    );
    expect(new Headers(init.headers).get('authorization')).toBe(
      'Bearer key_private',
    );
    expect(new Headers(init.headers).get('x-runway-version')).toBe(
      '2024-11-06',
    );
    expect(JSON.parse(String(init.body))).toMatchObject({
      version: '2026-06',
      mode: 'custom',
      shots: [{ duration: 4 }, { duration: 3 }, { duration: 3 }],
    });
  });

  it('downloads a completed result through the server and refuses arbitrary result hosts', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: 'SUCCEEDED',
            output: [
              'https://media-example.cloudfront.net/result.mp4?sig=private',
            ],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112])),
      );
    vi.stubGlobal('fetch', fetchMock);
    const bytes = await downloadRunwayVideo('key_private', taskId);
    expect([...bytes]).toEqual([0, 0, 0, 24, 102, 116, 121, 112]);
    expect(String(fetchMock.mock.calls[1]?.[0])).toBe(
      'https://media-example.cloudfront.net/result.mp4?sig=private',
    );

    const unsafeFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 'SUCCEEDED',
          output: ['https://127.0.0.1/private.mp4'],
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal('fetch', unsafeFetch);
    await expect(downloadRunwayVideo('key_private', taskId)).rejects.toThrow(
      'unsafe video result',
    );
    expect(unsafeFetch).toHaveBeenCalledTimes(1);
  });
});
