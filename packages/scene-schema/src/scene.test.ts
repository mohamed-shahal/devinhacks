import { describe, expect, it } from 'vitest';
import { applyPatch, sceneJsonSchema, patchJsonSchema } from './patch';
import { demoRefine } from './demo-refine';
import { demoGenerate, preset } from './presets';
import { sceneSchema, validateScene } from './schema';

describe('scene contract', () => {
  it('normalizes scene vectors to strict-output-compatible fixed numeric arrays', () => {
    const camera = (
      sceneJsonSchema.properties as {
        camera: { properties: { position: Record<string, unknown> } };
      }
    ).camera.properties.position;
    expect(camera).toMatchObject({
      type: 'array',
      minItems: 3,
      maxItems: 3,
      items: { type: 'number' },
    });
    const hasUnsupportedKeywords = (value: unknown): boolean => {
      if (!value || typeof value !== 'object') return false;
      if (Array.isArray(value)) return value.some(hasUnsupportedKeywords);
      return (
        'prefixItems' in value ||
        'oneOf' in value ||
        'const' in value ||
        'default' in value ||
        Object.values(value).some(hasUnsupportedKeywords)
      );
    };
    expect(hasUnsupportedKeywords(sceneJsonSchema)).toBe(false);
    expect(hasUnsupportedKeywords(patchJsonSchema)).toBe(false);
  });

  it('accepts editable presets and deterministic demo scenes', () => {
    expect(
      sceneSchema.parse(preset('Neon robot')).objects.length,
    ).toBeGreaterThan(0);
    expect(demoGenerate('a glowing forest').objects.length).toBeGreaterThan(0);
  });

  it('rejects extra executable fields and duplicate object IDs', () => {
    const scene = structuredClone(preset('Neon robot'));
    expect(() => sceneSchema.parse({ ...scene, script: 'alert(1)' })).toThrow();
    scene.objects.push(structuredClone(scene.objects[0]!));
    expect(() => validateScene(scene)).toThrow();
  });

  it('applies a targeted patch without changing unrelated objects', () => {
    const scene = preset('Neon robot');
    const other = structuredClone(scene.objects[0]!);
    const target = scene.objects[0]!;
    const result = applyPatch(
      scene,
      {
        baseRevision: 3,
        operations: [
          {
            op: 'updateObject',
            id: target.id,
            changes: { name: `${target.name} updated` },
          },
        ],
        explanation: 'Rename selected object',
        affectedIds: [target.id],
        warnings: [],
      },
      3,
    );
    expect(result.objects[0]?.name).toBe(`${target.name} updated`);
    expect(scene.objects[0]).toEqual(other);
  });

  it('rejects stale revisions and preserves the original scene', () => {
    const scene = preset('Neon robot');
    expect(() =>
      applyPatch(
        scene,
        {
          baseRevision: 2,
          operations: [{ op: 'removeObject', id: scene.objects[0]!.id }],
          explanation: 'Remove object',
          affectedIds: [scene.objects[0]!.id],
          warnings: [],
        },
        3,
      ),
    ).toThrow(/REVISION_CONFLICT/);
    expect(scene.objects.length).toBeGreaterThan(0);
  });

  it('offers honest deterministic refinement patches in demo mode', () => {
    const scene = preset('Neon robot');
    const robot = scene.objects.find(
      (object) => object.type === 'procedural_robot',
    )!;
    const patch = demoRefine('Make it taller', scene, 4, robot.id);
    const refined = applyPatch(scene, patch, 4);
    expect(
      refined.objects.find((object) => object.id === robot.id)?.transform
        .scale[1],
    ).toBeGreaterThan(robot.transform.scale[1]);
    expect(refined.objects.find((object) => object.id !== robot.id)).toEqual(
      scene.objects.find((object) => object.id !== robot.id),
    );
    expect(patch.warnings[0]).toContain('not an AI model');
    expect(() => demoRefine('invent a new planet', scene, 4, robot.id)).toThrow(
      /supports/,
    );
  });
});
