import { describe, expect, it, vi } from 'vitest';
import { filmInputSchema } from '@scenecraft/scene-schema';
import { FilmJobs } from './film-jobs';
import { pcmToWav } from '../providers/narration';
import { ProviderError } from '../providers/openai';

const input = filmInputSchema.parse({
  script: 'SCENE 1. A lantern glows beside an explorer.',
  mode: 'script',
  duration: 10,
  ratio: '16:9',
  resolution: '720p',
  audio: true,
  voice: 'marin',
  voiceModel: 'gpt-realtime-2.1-mini',
  shots: Array.from({ length: 3 }, () => ({
    angle: 'Wide establishing',
    movement: 'Slow dolly in',
    action: 'Reveal the explorer.',
  })),
});
const draft = {
  title: 'The lantern',
  narration: 'A lantern leads the explorer home.',
  focusId: 'explorer',
  background: '#101928',
  groundColor: '#25313a',
  fogColor: '#101928',
  cameraPosition: [4, 3, 7],
  cameraTarget: [0, 1, 0],
  fov: 40,
  lights: [
    {
      id: 'key',
      type: 'directional',
      color: '#fff3cc',
      intensity: 2,
      position: [3, 5, 3],
    },
    {
      id: 'fill',
      type: 'ambient',
      color: '#667799',
      intensity: 1,
      position: [0, 2, 0],
    },
  ],
  objects: ['explorer', 'lantern', 'mountain'].map((id, index) => ({
    id,
    name: id,
    type: 'sphere',
    parentId: index === 1 ? 'explorer' : null,
    position: [index * 2, 1, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    color: '#778899',
    emissive: '#000000',
    roughness: 0.5,
    metalness: 0.2,
    dimensions: [1, 1, 1],
    radius: 0.5,
    motion: index ? 'none' : 'bob',
    motionAxis: 'y',
    motionAmount: 0.2,
    destination: [0, 1, 0],
  })),
};
const generation = () => ({
  text: JSON.stringify(draft),
  latencyMs: 1,
  providerRequestId: 'resp_test',
  usage: undefined,
});
async function finished(jobs: FilmJobs, id: string) {
  await vi.waitFor(() => expect(jobs.get(id)?.status).not.toBe('preparing'));
  return jobs.get(id)!;
}
describe('film preparation jobs', () => {
  it('retries failed narration without repeating the paid scene generation and fits the voice duration', async () => {
    const generate = vi.fn().mockResolvedValue(generation());
    const wav = pcmToWav(Buffer.alloc(48000 * 12, 1));
    const narrate = vi
      .fn()
      .mockRejectedValueOnce(
        new ProviderError('PROVIDER_TIMEOUT', 'Voice timed out.'),
      )
      .mockResolvedValue({ wav, seconds: 12 });
    const jobs = new FilmJobs(async () => 'private-key', generate, narrate);
    const pending = jobs.create(input, 'configured-model', 'connection');
    expect((await finished(jobs, pending.id)).status).toBe('failed');
    jobs.retry(pending.id);
    const ready = await finished(jobs, pending.id);
    expect(ready.status).toBe('ready');
    expect(generate).toHaveBeenCalledTimes(1);
    expect(narrate).toHaveBeenCalledTimes(2);
    expect(ready.segments[0]!.durationSeconds).toBe(12.6);
    expect(ready.segments[0]!.scene.settings.durationSeconds).toBe(12.6);
    const track = jobs.narrationTrack(pending.id)!;
    expect((track.length - 44) / 48000).toBe(12.6);
    expect(track.subarray(44, 44 + 48000 * 12)).toEqual(wav.subarray(44));
    expect(JSON.stringify(ready)).not.toContain('private-key');
  });
  it('keeps completed scenes and script order when a later scene fails', async () => {
    const generate = vi
      .fn()
      .mockResolvedValueOnce(generation())
      .mockRejectedValueOnce(
        new ProviderError('PROVIDER_TIMEOUT', 'Scene timed out.'),
      )
      .mockResolvedValue(generation());
    const jobs = new FilmJobs(async () => 'private-key', generate, vi.fn());
    const request = {
      ...input,
      audio: false,
      script:
        'SCENE 1. Forest\nAn explorer finds a lantern.\n\nSCENE 2. Desert\nShe follows its light.',
    };
    const first = jobs.create(request, 'configured-model', 'connection');
    const failed = await finished(jobs, first.id);
    expect(failed.completedScenes).toBe(1);
    expect(failed.totalScenes).toBe(2);
    jobs.retry(first.id);
    const ready = await finished(jobs, first.id);
    expect(ready.completedScenes).toBe(2);
    expect(ready.status).toBe('ready');
    expect(generate).toHaveBeenCalledTimes(3);
    expect(String(generate.mock.calls[2]![3])).toContain('SCENE 2');
    expect(String(generate.mock.calls[2]![3])).toContain('"id":"lantern"');
    expect(jobs.narrationTrack(first.id)).toBeUndefined();
  });
  it('cancels the in-flight provider request and deletes cached media on explicit delete', async () => {
    const generate = vi
      .fn()
      .mockImplementation(
        (_key, _model, _system, _prompt, _format, _image, options) =>
          new Promise((_resolve, reject) =>
            options.signal.addEventListener('abort', () =>
              reject(new DOMException('Canceled', 'AbortError')),
            ),
          ),
      );
    const jobs = new FilmJobs(async () => 'key', generate, vi.fn());
    const pending = jobs.create(input, 'configured-model', 'connection');
    await vi.waitFor(() => expect(generate).toHaveBeenCalledOnce());
    jobs.cancel(pending.id);
    expect((await finished(jobs, pending.id)).status).toBe('canceled');
    jobs.delete(pending.id);
    expect(jobs.get(pending.id)).toBeUndefined();
  });
});
