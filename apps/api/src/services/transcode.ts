import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const maxInputBytes = 400 * 1024 * 1024;
const maxOutputBytes = 500 * 1024 * 1024;

export async function transcodeWebmToMp4(
  input: Uint8Array,
  narration?: Uint8Array,
) {
  if (input.byteLength > maxInputBytes)
    throw new Error('The recording is too large to convert locally.');
  if (
    input.byteLength < 4 ||
    input[0] !== 0x1a ||
    input[1] !== 0x45 ||
    input[2] !== 0xdf ||
    input[3] !== 0xa3
  )
    throw new Error('The recording is not a valid WebM file.');

  const directory = await mkdtemp(join(tmpdir(), 'scenecraft-render-'));
  const source = join(directory, 'capture.webm');
  const output = join(directory, 'film.mp4');
  try {
    await writeFile(source, input, { mode: 0o600, flag: 'wx' });
    const audio = join(directory, 'narration.wav');
    if (narration)
      await writeFile(audio, narration, { mode: 0o600, flag: 'wx' });
    await execFileAsync(
      'ffmpeg',
      [
        '-hide_banner',
        '-loglevel',
        'error',
        '-nostdin',
        '-y',
        '-i',
        source,
        ...(narration
          ? [
              '-i',
              audio,
              '-map',
              '0:v:0',
              '-map',
              '1:a:0',
              '-af',
              'apad',
              '-shortest',
            ]
          : ['-map', '0:v:0', '-map', '0:a?']),
        '-c:a',
        'aac',
        '-b:a',
        '160k',
        '-t',
        '600',
        '-c:v',
        'libx264',
        '-preset',
        'veryfast',
        '-crf',
        '19',
        '-pix_fmt',
        'yuv420p',
        '-movflags',
        '+faststart',
        output,
      ],
      { timeout: 300_000, maxBuffer: 1024 * 1024 },
    );
    const info = await stat(output);
    if (info.size < 1 || info.size > maxOutputBytes)
      throw new Error('The converted video is empty or too large.');
    return new Uint8Array(await readFile(output));
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT')
      throw new Error(
        'FFmpeg is unavailable; download the original WebM video.',
        { cause: error },
      );
    if (error instanceof Error && error.message.includes('timed out'))
      throw new Error(
        'Video conversion timed out; download the original WebM.',
        {
          cause: error,
        },
      );
    throw new Error(
      'The video or audio could not be encoded as MP4. Retry encoding; your prepared scenes and recording are kept.',
      {
        cause: error,
      },
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
