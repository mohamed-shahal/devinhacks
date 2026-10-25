import { patchSchema } from './patch';
import type { ScenePatch } from './patch';
import type { Scene } from './schema';

export function demoRefine(
  instruction: string,
  scene: Scene,
  baseRevision: number,
  selectedId: string | null,
): ScenePatch {
  const text = instruction.toLowerCase();
  const target =
    scene.objects.find((object) => object.id === selectedId) ??
    scene.objects.find((object) => object.type === 'procedural_robot') ??
    scene.objects[0];
  let operations: ScenePatch['operations'];
  let affectedIds: string[];
  let explanation: string;

  if (/\b(taller|higher)\b/.test(text) && target) {
    const transform = structuredClone(target.transform);
    transform.scale[1] = Math.min(100, transform.scale[1] * 1.25);
    operations = [
      { op: 'updateObject', id: target.id, changes: { transform } },
    ];
    affectedIds = [target.id];
    explanation = `Made ${target.name} taller.`;
  } else if (/\b(shorter|lower)\b/.test(text) && target) {
    const transform = structuredClone(target.transform);
    transform.scale[1] = Math.max(0.01, transform.scale[1] * 0.8);
    operations = [
      { op: 'updateObject', id: target.id, changes: { transform } },
    ];
    affectedIds = [target.id];
    explanation = `Made ${target.name} shorter.`;
  } else if (/\b(slow|slower)\b/.test(text) && target) {
    const animation =
      target.animations.find((item) => item.type === 'dance') ??
      target.animations[0];
    if (!animation)
      throw new Error(
        'This demo refinement needs an animated object. Add an animation or ask for a height change.',
      );
    operations = [
      {
        op: 'updateAnimation',
        objectId: target.id,
        id: animation.id,
        changes: { speed: Math.max(0.1, animation.speed * 0.65) },
      },
    ];
    affectedIds = [target.id, animation.id];
    explanation = `Slowed ${target.name}'s ${animation.type.replaceAll('_', ' ')} animation.`;
  } else if (/\b(rain|rainy)\b/.test(text)) {
    const effects = structuredClone(scene.environment.effects);
    if (!effects.some((effect) => effect.type === 'rain')) {
      const ids = new Set([
        ...scene.objects.map((object) => object.id),
        ...scene.lights.map((light) => light.id),
        ...scene.environment.effects.map((effect) => effect.id),
        ...scene.objects.flatMap((object) =>
          object.animations.map((animation) => animation.id),
        ),
      ]);
      let id = `demo_rain_${baseRevision}`;
      let suffix = 1;
      while (ids.has(id)) id = `demo_rain_${baseRevision}_${suffix++}`;
      effects.push({ id, type: 'rain', intensity: 0.45 });
    }
    if (effects.length > 4)
      throw new Error(
        'This scene already has the maximum number of environment effects.',
      );
    operations = [{ op: 'updateEnvironment', changes: { effects } }];
    affectedIds = effects
      .filter((effect) => effect.type === 'rain')
      .map((effect) => effect.id);
    explanation = 'Added a local procedural rain effect.';
  } else {
    throw new Error(
      'Demo refinement supports “make it taller”, “make it shorter”, “slow the animation”, or “add rain”. Try a more specific supported change.',
    );
  }

  return patchSchema.parse({
    baseRevision,
    operations,
    explanation,
    affectedIds,
    warnings: [
      'Local demo refinement: this change was created from a small set of deterministic rules, not an AI model.',
    ],
  });
}
