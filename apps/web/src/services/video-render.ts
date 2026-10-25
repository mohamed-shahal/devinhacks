import { SceneRuntime } from '@scenecraft/scene-runtime';
import type { Scene, FilmSegment } from '@scenecraft/scene-schema';
import type { VideoShot } from '../api/studio';

export type VideoRatio = '16:9' | '9:16' | '1:1';
export type RenderResolution = '720p' | '1080p';
function canvasSize(ratio: VideoRatio, resolution: RenderResolution) {
  const height = resolution === '1080p' ? 1080 : 720;
  const width = Math.round((height * 16) / 9 / 2) * 2;
  if (ratio === '9:16') return [height, width] as const;
  if (ratio === '1:1') return [height, height] as const;
  return [width, height] as const;
}
function renderableScene(input: Scene, duration: number): Scene {
  const scene = structuredClone(input);
  scene.settings.durationSeconds = duration;
  scene.settings.loop = false;
  scene.settings.quality = 'high';
  for (const object of scene.objects)
    object.animations = object.animations.filter(
      (animation) =>
        animation.type !== 'camera_dolly' && animation.type !== 'camera_orbit',
    );
  return scene;
}

export function filmFrameAt(
  time: number,
  durations: number[],
  shotCounts: number[],
) {
  const total = durations.reduce((sum, seconds) => sum + seconds, 0);
  const elapsed = Math.max(
    0,
    Math.min(total, Number.isFinite(time) ? time : 0),
  );
  let start = 0;
  let segmentIndex = 0;
  for (let index = 0; index < durations.length; index++) {
    segmentIndex = index;
    if (elapsed < start + durations[index]! || index === durations.length - 1)
      break;
    start += durations[index]!;
  }
  const local = Math.max(
    0,
    Math.min(durations[segmentIndex]!, elapsed - start),
  );
  const shotDuration = durations[segmentIndex]! / shotCounts[segmentIndex]!;
  const shotIndex = Math.max(
    0,
    Math.min(shotCounts[segmentIndex]! - 1, Math.floor(local / shotDuration)),
  );
  return {
    segmentIndex,
    local,
    shotIndex,
    shotProgress: Math.min(
      1,
      (local - shotIndex * shotDuration) / shotDuration,
    ),
    elapsed,
    total,
  };
}

export async function renderFilmVideo(
  segments: FilmSegment[],
  ratio: VideoRatio,
  resolution: RenderResolution,
  onProgress: (progress: number) => void,
  signal?: AbortSignal,
): Promise<Blob> {
  if (!segments.length || segments.some((segment) => !segment.shots.length))
    throw new Error('Prepare at least one scene and camera sequence.');
  if (typeof MediaRecorder === 'undefined')
    throw new Error('This browser cannot record the Three.js video.');
  const mimeType = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ].find((type) => MediaRecorder.isTypeSupported(type));
  if (!mimeType)
    throw new Error('This browser does not support WebM video recording.');
  signal?.throwIfAborted();
  const [width, height] = canvasSize(ratio, resolution);
  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  Object.assign(host.style, {
    position: 'fixed',
    left: '-2200px',
    top: '0',
    width: `${width}px`,
    height: `${height}px`,
    overflow: 'hidden',
    pointerEvents: 'none',
  });
  document.body.append(host);
  const runtime = new SceneRuntime({ cinematic: true, pixelRatio: 1 });
  let stream: MediaStream | null = null;
  let recorder: MediaRecorder | null = null;
  let animationFrame = 0;
  let abort: (() => void) | undefined;
  try {
    runtime.mount(
      host,
      renderableScene(segments[0]!.scene, segments[0]!.durationSeconds),
    );
    runtime.pause();
    runtime.resize(width, height);
    runtime.setQuality('high');
    const canvas = runtime.getCanvas();
    if (!canvas) throw new Error('Three.js could not create a render surface.');
    stream = canvas.captureStream(30);
    const chunks: BlobPart[] = [];
    let recordedBytes = 0;
    recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: resolution === '1080p' ? 4_000_000 : 2_500_000,
    });
    const output = new Promise<Blob>((resolve, reject) => {
      recorder!.ondataavailable = (event) => {
        recordedBytes += event.data.size;
        if (recordedBytes > 390 * 1024 * 1024) {
          reject(
            new Error(
              'This film exceeds the 390 MB recording limit. Use 720p or a shorter script.',
            ),
          );
          return;
        }
        if (event.data.size) chunks.push(event.data);
      };
      recorder!.onerror = () =>
        reject(new Error('The browser video recording failed.'));
      recorder!.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType });
        if (!blob.size)
          reject(new Error('The video render produced no frames.'));
        else resolve(blob);
      };
    });
    // Attach a handler immediately: a frame failure can stop the recorder before
    // output is awaited, and must never create an unhandled rejection.
    void output.catch(() => undefined);
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => resolve()),
    );
    signal?.throwIfAborted();
    const startedAt = performance.now();
    const durations = segments.map((segment) => segment.durationSeconds);
    const counts = segments.map((segment) => segment.shots.length);
    let currentSegment = 0;
    recorder.start(500);
    const frames = new Promise<void>((resolve, reject) => {
      abort = () =>
        reject(
          new DOMException(
            'Render canceled. Prepared scenes are kept.',
            'AbortError',
          ),
        );
      signal?.addEventListener('abort', abort, { once: true });
      const draw = () => {
        try {
          signal?.throwIfAborted();
          const frame = filmFrameAt(
            (performance.now() - startedAt) / 1000,
            durations,
            counts,
          );
          const segment = segments[frame.segmentIndex]!;
          if (currentSegment !== frame.segmentIndex) {
            runtime.updateScene(
              renderableScene(segment.scene, segment.durationSeconds),
            );
            runtime.pause();
            currentSegment = frame.segmentIndex;
          }
          runtime.seek(frame.local);
          const shot = segment.shots[frame.shotIndex]!;
          runtime.setCinematicCamera(
            shot.angle,
            shot.movement,
            frame.shotProgress,
            frame.shotIndex,
            segment.focusId,
          );
          runtime.renderFrame();
          onProgress(
            Math.min(100, Math.round((frame.elapsed / frame.total) * 100)),
          );
          if (frame.elapsed >= frame.total) {
            recorder?.stop();
            resolve();
            return;
          }
          animationFrame = requestAnimationFrame(draw);
        } catch (error) {
          reject(error);
        }
      };
      animationFrame = requestAnimationFrame(draw);
    });
    // Recorder failures must also terminate the frame loop promptly.
    await Promise.race([
      frames,
      output.then(() => {
        throw new Error(
          'The recorder stopped before the film finished. Retry rendering.',
        );
      }),
    ]);
    return await output;
  } finally {
    if (abort) signal?.removeEventListener('abort', abort);
    cancelAnimationFrame(animationFrame);
    if (recorder?.state === 'recording') recorder.stop();
    stream?.getTracks().forEach((track) => track.stop());
    runtime.dispose();
    host.remove();
  }
}

export function renderSceneVideo(
  scene: Scene,
  shots: VideoShot[],
  duration: 10 | 15,
  ratio: VideoRatio,
  onProgress: (progress: number) => void,
) {
  return renderFilmVideo(
    [
      {
        title: scene.metadata.title,
        narration: '',
        durationSeconds: duration,
        focusId: null,
        scene,
        shots,
        audioUrl: null,
      },
    ],
    ratio,
    '720p',
    onProgress,
  );
}
