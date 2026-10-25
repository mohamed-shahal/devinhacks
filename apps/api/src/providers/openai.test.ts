import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateOpenAI } from './openai';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('OpenAI provider errors', () => {
  it('surfaces a bounded provider validation message without leaking credentials', async () => {
    const key = 'sk-test-secret-credential-value';
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            type: 'invalid_request_error',
            message: `Invalid schema: prefixItems rejected while using Bearer ${key}`,
          },
        }),
        { status: 400 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      generateOpenAI(key, 'gpt-test', 'system', 'prompt', {}),
    ).rejects.toMatchObject({
      code: 'PROVIDER_ERROR',
      message:
        'Invalid schema: prefixItems rejected while using Bearer [redacted]',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('keeps the generic status message when the provider body is not structured', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(new Response('upstream failure', { status: 400 })),
    );

    await expect(
      generateOpenAI('test-key', 'gpt-test', 'system', 'prompt', {}),
    ).rejects.toMatchObject({
      code: 'PROVIDER_ERROR',
      message: 'Provider request failed with status 400.',
    });
  });
});

describe('long-running scene generation', () => {
  it('polls the same background response beyond two minutes instead of submitting twice', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockImplementation(async (_url, init) => {
      if (init?.method === 'POST')
        return Response.json({ id: 'resp_long', status: 'queued' });
      if (Date.now() < 180_000)
        return Response.json({ id: 'resp_long', status: 'in_progress' });
      return Response.json({
        id: 'resp_long',
        status: 'completed',
        output_text: '{"ok":true}',
      });
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.setSystemTime(0);
    const pending = generateOpenAI(
      'private-key',
      'test-model',
      'system',
      'long script',
      {},
    );
    const assertion = expect(pending).resolves.toMatchObject({
      text: '{"ok":true}',
    });
    await vi.advanceTimersByTimeAsync(185_000);
    await assertion;
    const submissions = fetchMock.mock.calls.filter(
      (call) => call[1]?.method === 'POST',
    );
    expect(submissions).toHaveLength(1);
    expect(JSON.parse(submissions[0]![1].body)).toMatchObject({
      background: true,
      store: false,
    });
  });
});

describe('background generation failure recovery', () => {
  it('recovers a transient polling failure without resubmitting generation', async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ id: 'resp_retry', status: 'queued' }),
      )
      .mockResolvedValueOnce(
        Response.json(
          { error: { message: 'Temporary issue.' } },
          { status: 503 },
        ),
      )
      .mockResolvedValueOnce(
        Response.json({
          id: 'resp_retry',
          status: 'completed',
          output_text: '{}',
        }),
      );
    vi.stubGlobal('fetch', fetchMock);
    const pending = generateOpenAI(
      'private-key',
      'model',
      'system',
      'prompt',
      {},
    );
    const assertion = expect(pending).resolves.toMatchObject({ text: '{}' });
    await vi.advanceTimersByTimeAsync(6000);
    await assertion;
    expect(
      fetchMock.mock.calls.filter((call) => call[1]?.method === 'POST'),
    ).toHaveLength(1);
  });
  it('cancels the remote response when the local job is canceled', async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        Response.json({ id: 'resp_cancel', status: 'queued' }),
      );
    vi.stubGlobal('fetch', fetchMock);
    const controller = new AbortController();
    const pending = generateOpenAI(
      'key',
      'model',
      'system',
      'prompt',
      {},
      undefined,
      { signal: controller.signal },
    );
    const assertion = expect(pending).rejects.toMatchObject({
      name: 'AbortError',
    });
    await vi.advanceTimersByTimeAsync(1);
    controller.abort();
    await assertion;
    expect(fetchMock.mock.calls.at(-1)![0]).toBe(
      'https://api.openai.com/v1/responses/resp_cancel/cancel',
    );
  });
});
