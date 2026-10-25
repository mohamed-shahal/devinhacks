import { describe, expect, it } from 'vitest';
import { splitFilmScript, filmInputSchema } from './film';

describe('script films', () => {
  it('keeps all content in a long script, in order, under the scene limit', () => {
    const script = Array.from(
      { length: 35 },
      (_, index) =>
        `Paragraph ${index}. ${'A traveler crosses the valley and follows the light. '.repeat(5)}\n\n`,
    )
      .join('')
      .trim();
    const chunks = splitFilmScript(script, 'script');
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.length).toBeLessThanOrEqual(12);
    expect(chunks.join('')).toBe(script);
    expect(chunks.every((chunk) => chunk.trim().length > 0)).toBe(true);
  });
  it('recognizes explicit screenplay scene boundaries', () => {
    const script =
      'SCENE 1 — Forest\nA traveler finds a lantern.\n\nSCENE 2 — Mountain\nThe lantern leads her home.';
    const chunks = splitFilmScript(script, 'script');
    expect(chunks).toHaveLength(2);
    expect(chunks[1]).toContain('SCENE 2');
    expect(chunks.join('')).toBe(script);
    expect(splitFilmScript(script, 'brief')).toEqual([script]);
  });
  it('rejects excessive scripts before a provider request', () => {
    expect(
      filmInputSchema.safeParse({ script: 'x'.repeat(12001) }).success,
    ).toBe(false);
  });
});
