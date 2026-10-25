import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';
import { transcodeWebmToMp4 } from './transcode';
import { pcmToWav } from '../providers/narration';

const run = promisify(execFile);
let ffmpeg = false;
try {
  await run('ffmpeg', ['-version']);
  await run('ffprobe', ['-version']);
  ffmpeg = true;
} catch {
  /* Optional local encoder is tested only when installed. */
}
describe('film export', () => {
  it.skipIf(!ffmpeg)(
    'exports H.264 video and a real AAC audio stream without dropping narration',
    async () => {
      const directory = await mkdtemp(join(tmpdir(), 'scenecraft-mux-test-'));
      try {
        const webm = join(directory, 'input.webm');
        await run('ffmpeg', [
          '-hide_banner',
          '-loglevel',
          'error',
          '-f',
          'lavfi',
          '-i',
          'color=c=black:s=64x64:r=30:d=1.2',
          '-c:v',
          'libvpx-vp9',
          webm,
        ]);
        const pcm = Buffer.alloc(48000);
        for (let sample = 0; sample < 24000; sample++)
          pcm.writeInt16LE(
            Math.round(Math.sin((sample / 24000) * Math.PI * 2 * 440) * 5000),
            sample * 2,
          );
        const output = await transcodeWebmToMp4(
          await readFile(webm),
          pcmToWav(pcm),
        );
        const file = join(directory, 'film.mp4');
        await writeFile(file, output);
        const probe = JSON.parse(
          (
            await run('ffprobe', [
              '-v',
              'error',
              '-show_streams',
              '-show_format',
              '-of',
              'json',
              file,
            ])
          ).stdout,
        ) as {
          streams: {
            codec_type: string;
            codec_name: string;
            duration: string;
          }[];
          format: { duration: string };
        };
        expect(
          probe.streams.find((stream) => stream.codec_type === 'audio')
            ?.codec_name,
        ).toBe('aac');
        expect(
          probe.streams.find((stream) => stream.codec_type === 'video')
            ?.codec_name,
        ).toBe('h264');
        expect(Number(probe.format.duration)).toBeGreaterThanOrEqual(1.1);
      } finally {
        await rm(directory, { recursive: true, force: true });
      }
    },
    20_000,
  );
});
