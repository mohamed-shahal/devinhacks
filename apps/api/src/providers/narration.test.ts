import { EventEmitter } from 'node:events';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateNarration } from './narration';

const sockets = vi.hoisted(() => ({
  instances: [] as Array<{
    send: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
    emit: (event: string, data?: unknown) => boolean;
    url: string;
    options: { headers: Record<string, string> };
  }>,
}));
vi.mock('ws', () => ({
  default: class extends EventEmitter {
    url: string;
    options: { headers: Record<string, string> };
    send = vi.fn();
    close = vi.fn();
    constructor(url: string, options: { headers: Record<string, string> }) {
      super();
      this.url = url;
      this.options = options;
      sockets.instances.push(this);
    }
  },
}));
afterEach(() => {
  sockets.instances.length = 0;
});
const event = (value: unknown) => Buffer.from(JSON.stringify(value));

describe('server-side narration', () => {
  it('assembles real PCM chunks in order and calculates the actual voice duration', async () => {
    const controller = new AbortController();
    const audio = generateNarration(
      'private-key',
      'The lantern shines.',
      'cedar',
      'gpt-realtime-2.1-mini',
      controller.signal,
    );
    const socket = sockets.instances[0]!;
    expect(socket.url).not.toContain('private-key');
    expect(socket.options.headers.Authorization).toBe('Bearer private-key');
    socket.emit('open');
    socket.emit('message', event({ type: 'session.updated' }));
    expect(
      JSON.parse(socket.send.mock.calls[1]![0]).response.input[0].content[0]
        .text,
    ).toBe('The lantern shines.');
    socket.emit(
      'message',
      event({
        type: 'response.output_audio.delta',
        delta: Buffer.alloc(24000, 1).toString('base64'),
      }),
    );
    socket.emit(
      'message',
      event({
        type: 'response.output_audio.delta',
        delta: Buffer.alloc(24000, 2).toString('base64'),
      }),
    );
    socket.emit(
      'message',
      event({ type: 'response.done', response: { status: 'completed' } }),
    );
    const result = await audio;
    expect(result.seconds).toBe(1);
    expect(result.wav.toString('ascii', 0, 4)).toBe('RIFF');
    expect(result.wav.length).toBe(48044);
    expect(result.wav[44]).toBe(1);
    expect(result.wav[24044]).toBe(2);
    expect(socket.close).toHaveBeenCalledOnce();
  });
  it('sanitizes provider failures and rejects empty/refused audio', async () => {
    const pending = generateNarration(
      'private-key',
      'Hello.',
      'marin',
      'gpt-realtime-2.1-mini',
      new AbortController().signal,
    );
    const assertion = expect(pending).rejects.toThrow(
      'Invalid voice for [redacted]',
    );
    sockets.instances[0]!.emit(
      'message',
      event({
        type: 'error',
        error: { message: 'Invalid voice for private-key' },
      }),
    );
    await assertion;
  });
  it('closes the paid audio stream on cancellation', async () => {
    const controller = new AbortController();
    const pending = generateNarration(
      'key',
      'Hello.',
      'marin',
      'gpt-realtime-2.1-mini',
      controller.signal,
    );
    const assertion = expect(pending).rejects.toMatchObject({
      name: 'AbortError',
    });
    controller.abort();
    await assertion;
    expect(sockets.instances[0]!.close).toHaveBeenCalledOnce();
  });
});
