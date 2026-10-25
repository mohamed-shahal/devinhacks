import { z } from 'zod';
import { sceneSchema } from './schema';

export const filmLimits = {
  scriptCharacters: 12_000,
  scenes: 12,
  seconds: 600,
} as const;
export const filmShotSchema = z.strictObject({
  angle: z.string().min(2).max(80),
  movement: z.string().min(2).max(80),
  action: z.string().min(3).max(300),
});
export const filmInputSchema = z.strictObject({
  script: z.string().trim().min(8).max(filmLimits.scriptCharacters),
  mode: z.enum(['brief', 'script']),
  duration: z.union([z.literal(10), z.literal(15)]),
  ratio: z.enum(['16:9', '9:16', '1:1']),
  resolution: z.enum(['720p', '1080p']),
  audio: z.boolean(),
  voice: z.enum(['marin', 'cedar', 'coral']),
  voiceModel: z.enum(['gpt-realtime-2.1-mini', 'gpt-realtime-2.1']),
  shots: z.array(filmShotSchema).min(3).max(5),
  modelId: z.string().min(1).max(160).optional(),
});
export type FilmInput = z.infer<typeof filmInputSchema>;
export const filmSegmentSchema = z.strictObject({
  title: z.string().min(1).max(120),
  narration: z.string().max(2500),
  durationSeconds: z.number().min(1).max(180),
  focusId: z.string().nullable(),
  scene: sceneSchema,
  shots: z.array(filmShotSchema).min(1).max(5),
  audioUrl: z.string().startsWith('/api/v1/films/').nullable(),
});
export type FilmSegment = z.infer<typeof filmSegmentSchema>;
export const filmJobSchema = z.strictObject({
  id: z.string().uuid(),
  status: z.enum(['preparing', 'ready', 'failed', 'canceled']),
  stage: z.string().max(300),
  completedScenes: z.number().int().min(0).max(12),
  totalScenes: z.number().int().min(1).max(12),
  modelId: z.string(),
  input: filmInputSchema,
  segments: z.array(filmSegmentSchema).max(12),
  error: z.string().nullable(),
  updatedAt: z.number(),
});
export type FilmJob = z.infer<typeof filmJobSchema>;

/** Preserve every character; prefer scene/paragraph/sentence boundaries. */
export function splitFilmScript(
  script: string,
  mode: FilmInput['mode'],
): string[] {
  if (mode === 'brief') return [script.trim()];
  const text = script.trim();
  const headings = [
    ...text.matchAll(/^(?:SCENE\s+\d+[^\n]*|INT\.[^\n]*|EXT\.[^\n]*)/gim),
  ].map((match) => match.index!);
  if (headings.length > 1 && headings.length <= filmLimits.scenes) {
    const starts = [0, ...headings.filter((index) => index > 0)];
    const sections = starts.flatMap((start, index) => {
      const section = text.slice(start, starts[index + 1] ?? text.length);
      return section.length > 1800
        ? splitFilmScript(section, 'script')
        : [section];
    });
    if (sections.length > filmLimits.scenes)
      sections.splice(
        filmLimits.scenes - 1,
        sections.length,
        sections.slice(filmLimits.scenes - 1).join(''),
      );
    return sections;
  }
  const target = Math.max(700, Math.ceil(text.length / filmLimits.scenes));
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    if (text.length - start <= target * 1.25) {
      chunks.push(text.slice(start));
      break;
    }
    const window = text.slice(start, start + target);
    const preferred = [...window.matchAll(/\n\s*\n|(?<=[.!?])\s+(?=[A-Z\d])/g)]
      .map((match) => match.index! + match[0].length)
      .filter((index) => index > target * 0.55);
    const end =
      start +
      (preferred.at(-1) ??
        (window.lastIndexOf(' ') > target * 0.55
          ? window.lastIndexOf(' ') + 1
          : target));
    chunks.push(text.slice(start, end));
    start = end;
  }
  // Boundary choices can produce more than twelve chunks. Merge the tail;
  // never drop script text to satisfy a scene count.
  if (chunks.length > filmLimits.scenes)
    chunks.splice(
      filmLimits.scenes - 1,
      chunks.length,
      chunks.slice(filmLimits.scenes - 1).join(''),
    );
  return chunks;
}
