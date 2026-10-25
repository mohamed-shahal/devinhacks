import type { Animation, Transform } from '@scenecraft/scene-schema';
export function progress(a: Animation, time: number) {
  const elapsed =
    (Math.max(0, time - a.startSeconds) * a.speed) / a.durationSeconds;
  if (time < a.startSeconds) return 0;
  if (a.mode === 'once') return Math.min(1, elapsed);
  if (a.mode === 'ping-pong') {
    const n = elapsed % 2;
    return n <= 1 ? n : 2 - n;
  }
  return elapsed % 1;
}
export function evaluateTransform(
  base: Transform,
  tracks: Animation[],
  time: number,
): Transform {
  const result = structuredClone(base);
  for (const a of tracks) {
    if (!a.enabled || time < a.startSeconds) continue;
    const p = progress(a, time);
    const wave = Math.sin(p * Math.PI * 2);
    const axis = a.axis === 'x' ? 0 : a.axis === 'y' ? 1 : 2;
    if (a.type === 'rotate') result.rotation[axis] += p * a.amplitude;
    if (a.type === 'bob') result.position[axis] += wave * a.amplitude;
    if (a.type === 'pulse')
      result.scale = result.scale.map((n) =>
        Math.max(0.01, n * (1 + wave * Math.min(0.9, a.amplitude))),
      ) as Transform['scale'];
    if (a.type === 'move')
      result.position = a.from.map(
        (n, i) =>
          n +
          (a.to[i]! - n) *
            (a.interpolation === 'smooth' ? p * p * (3 - 2 * p) : p),
      ) as Transform['position'];
    if (a.type === 'dance') {
      result.position[1] += Math.abs(wave) * a.amplitude * 0.25;
      result.rotation[1] += wave * a.amplitude * 0.4;
      result.rotation[2] += wave * a.amplitude * 0.1;
    }
    if (a.type === 'keyframe') {
      const t = p * a.durationSeconds;
      let left = a.keyframes[0]!,
        right = a.keyframes.at(-1)!;
      for (let i = 1; i < a.keyframes.length; i++) {
        if (a.keyframes[i]!.time >= t) {
          left = a.keyframes[i - 1]!;
          right = a.keyframes[i]!;
          break;
        }
      }
      let f = Math.max(
        0,
        Math.min(1, (t - left.time) / (right.time - left.time || 1)),
      );
      if (a.interpolation === 'smooth') f = f * f * (3 - 2 * f);
      result[a.property] = left.value.map(
        (n, i) => n + (right.value[i]! - n) * f,
      ) as Transform['position'];
    }
  }
  return result;
}
export class PlaybackClock {
  time = 0;
  playing = false;
  speed = 1;
  duration = 8;
  loop = true;
  tick(delta: number) {
    if (!this.playing) return this.time;
    this.time += Math.max(0, Math.min(delta, 0.1)) * this.speed;
    if (this.time >= this.duration) {
      if (this.loop) this.time %= this.duration;
      else {
        this.time = this.duration;
        this.playing = false;
      }
    }
    return this.time;
  }
  seek(t: number) {
    this.time = Math.max(0, Math.min(this.duration, t));
  }
  reset() {
    this.time = 0;
    this.playing = false;
  }
}
