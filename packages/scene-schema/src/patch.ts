import { z } from 'zod';
import {
  animationSchema,
  cameraSchema,
  environmentSchema,
  id,
  lightSchema,
  objectSchema,
  sceneSchema,
  settingsSchema,
  validateScene,
} from './schema';
import type { Scene } from './schema';
const operationSchema = z.discriminatedUnion('op', [
  z.strictObject({ op: z.literal('addObject'), object: objectSchema }),
  z.strictObject({
    op: z.literal('updateObject'),
    id,
    changes: objectSchema.omit({ id: true }).partial(),
  }),
  z.strictObject({ op: z.literal('removeObject'), id }),
  z.strictObject({ op: z.literal('addLight'), light: lightSchema }),
  z.strictObject({
    op: z.literal('updateLight'),
    id,
    changes: lightSchema.omit({ id: true }).partial(),
  }),
  z.strictObject({ op: z.literal('removeLight'), id }),
  z.strictObject({
    op: z.literal('updateCamera'),
    changes: cameraSchema.partial(),
  }),
  z.strictObject({
    op: z.literal('updateEnvironment'),
    changes: environmentSchema.partial(),
  }),
  z.strictObject({
    op: z.literal('updateSettings'),
    changes: settingsSchema.partial(),
  }),
  z.strictObject({
    op: z.literal('addAnimation'),
    objectId: id,
    animation: animationSchema,
  }),
  z.strictObject({
    op: z.literal('updateAnimation'),
    objectId: id,
    id,
    changes: animationSchema.omit({ id: true }).partial(),
  }),
  z.strictObject({ op: z.literal('removeAnimation'), objectId: id, id }),
]);
export const patchSchema = z.strictObject({
  baseRevision: z.number().int().min(0),
  operations: z.array(operationSchema).min(1).max(100),
  explanation: z.string().min(1).max(1000),
  affectedIds: z.array(id).max(200),
  warnings: z.array(z.string().max(300)).max(20),
});
export type ScenePatch = z.infer<typeof patchSchema>;
export function applyPatch(
  scene: Scene,
  input: unknown,
  revision: number,
  assets: ReadonlySet<string> = new Set(),
): Scene {
  const patch = patchSchema.parse(input);
  if (patch.baseRevision !== revision)
    throw new Error(
      'REVISION_CONFLICT: the scene changed. Request a new refinement.',
    );
  const next = structuredClone(scene);
  for (const op of patch.operations) {
    if (op.op === 'addObject') next.objects.push(op.object);
    else if (op.op === 'updateObject') {
      const o = next.objects.find((x) => x.id === op.id);
      if (!o) throw new Error('Object not found.');
      Object.assign(o, op.changes);
    } else if (op.op === 'removeObject') {
      if (!next.objects.some((x) => x.id === op.id))
        throw new Error('Object not found.');
      const removed = new Set([op.id]);
      for (let i = 0; i < next.objects.length; i++)
        for (const o of next.objects)
          if (o.parentId && removed.has(o.parentId)) removed.add(o.id);
      next.objects = next.objects.filter((o) => !removed.has(o.id));
    } else if (op.op === 'addLight') next.lights.push(op.light);
    else if (op.op === 'updateLight') {
      const l = next.lights.find((x) => x.id === op.id);
      if (!l) throw new Error('Light not found.');
      Object.assign(l, op.changes);
    } else if (op.op === 'removeLight') {
      if (!next.lights.some((x) => x.id === op.id))
        throw new Error('Light not found.');
      next.lights = next.lights.filter((x) => x.id !== op.id);
    } else if (op.op === 'updateCamera') Object.assign(next.camera, op.changes);
    else if (op.op === 'updateEnvironment')
      Object.assign(next.environment, op.changes);
    else if (op.op === 'updateSettings')
      Object.assign(next.settings, op.changes);
    else {
      const o = next.objects.find((x) => x.id === op.objectId);
      if (!o) throw new Error('Object not found.');
      if (op.op === 'addAnimation') o.animations.push(op.animation);
      else {
        const a = o.animations.find((x) => x.id === op.id);
        if (!a) throw new Error('Animation not found.');
        if (op.op === 'updateAnimation') Object.assign(a, op.changes);
        else o.animations = o.animations.filter((x) => x.id !== op.id);
      }
    }
  }
  return validateScene(next, assets);
}
/**
 * Convert Zod's draft 2020-12 JSON Schema into OpenAI Structured Outputs' schema
 * subset. The local Zod schemas remain authoritative for validation; this only
 * normalizes representation (not the values accepted by the app).
 */
export function toOpenAIStructuredSchema(
  input: unknown,
): Record<string, unknown> {
  function normalize(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(normalize);
    if (!value || typeof value !== 'object') return value;

    const source = value as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(source)) {
      if (key === '$schema' || key === 'default') continue;
      if (key === 'items' && Array.isArray(source.prefixItems)) continue;
      if (key === 'oneOf') {
        result.anyOf = normalize(child);
        continue;
      }
      if (key === 'const') {
        result.enum = [normalize(child)];
        continue;
      }
      if (key === 'prefixItems' && Array.isArray(child)) {
        const items = child.map(normalize);
        const first = JSON.stringify(items[0]);
        result.items = items.every((item) => JSON.stringify(item) === first)
          ? items[0]
          : { anyOf: items };
        result.minItems = child.length;
        result.maxItems = child.length;
        continue;
      }
      result[key] = normalize(child);
    }
    return result;
  }

  const schema = normalize(input);
  if (!schema || typeof schema !== 'object' || Array.isArray(schema))
    throw new Error('Structured output schema root must be an object.');
  return schema as Record<string, unknown>;
}

export const sceneJsonSchema = toOpenAIStructuredSchema(
  z.toJSONSchema(sceneSchema),
);
export const patchJsonSchema = toOpenAIStructuredSchema(
  z.toJSONSchema(patchSchema),
);
