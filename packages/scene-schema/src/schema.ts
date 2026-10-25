import { z } from 'zod';
export const id = z.string().regex(/^[a-zA-Z][a-zA-Z0-9_-]{0,79}$/);
export const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const finite = z.number().finite();
export const vec3 = z.tuple([
  finite.min(-10000).max(10000),
  finite.min(-10000).max(10000),
  finite.min(-10000).max(10000),
]);
export const transformSchema = z.strictObject({
  position: vec3,
  rotation: vec3,
  scale: z.tuple([
    finite.min(0.01).max(100),
    finite.min(0.01).max(100),
    finite.min(0.01).max(100),
  ]),
});
export const materialSchema = z.strictObject({
  type: z.enum(['standard', 'basic']).default('standard'),
  color: color.default('#b8c7d9'),
  roughness: finite.min(0).max(1).default(0.5),
  metalness: finite.min(0).max(1).default(0.2),
  opacity: finite.min(0).max(1).default(1),
  emissive: color.default('#000000'),
});
export const animationSchema = z.strictObject({
  id,
  type: z.enum([
    'rotate',
    'bob',
    'move',
    'pulse',
    'dance',
    'particles',
    'camera_orbit',
    'camera_dolly',
    'keyframe',
  ]),
  enabled: z.boolean().default(true),
  startSeconds: finite.min(0).max(300).default(0),
  durationSeconds: finite.min(0.1).max(300).default(4),
  mode: z.enum(['loop', 'once', 'ping-pong']).default('loop'),
  axis: z.enum(['x', 'y', 'z']).default('y'),
  amplitude: finite.min(0).max(100).default(0.3),
  speed: finite.min(0.01).max(10).default(1),
  from: vec3.default([0, 0, 0]),
  to: vec3.default([0, 2, 0]),
  property: z.enum(['position', 'rotation', 'scale']).default('position'),
  interpolation: z.enum(['linear', 'smooth']).default('smooth'),
  keyframes: z
    .array(z.strictObject({ time: finite.min(0).max(300), value: vec3 }))
    .max(100)
    .default([]),
});
export const objectTypes = [
  'group',
  'box',
  'sphere',
  'capsule',
  'cylinder',
  'cone',
  'torus',
  'plane',
  'procedural_robot',
  'procedural_tree',
  'procedural_building',
  'particles',
  'asset',
] as const;
export const propertiesSchema = z.strictObject({
  width: finite.min(0.01).max(100).default(1),
  height: finite.min(0.01).max(100).default(1),
  depth: finite.min(0.01).max(100).default(1),
  radius: finite.min(0.01).max(100).default(0.5),
  bodyColor: color.default('#aabbd0'),
  accentColor: color.default('#62eddd'),
  eyeColor: color.default('#f7abdb'),
  count: z.number().int().min(1).max(5000).default(250),
  assetId: id.nullable().default(null),
});
export const objectSchema = z.strictObject({
  id,
  name: z.string().min(1).max(120),
  type: z.enum(objectTypes),
  parentId: id.nullable().default(null),
  visible: z.boolean().default(true),
  transform: transformSchema,
  material: materialSchema,
  properties: propertiesSchema.default({
    width: 1,
    height: 1,
    depth: 1,
    radius: 0.5,
    bodyColor: '#aabbd0',
    accentColor: '#62eddd',
    eyeColor: '#f7abdb',
    count: 250,
    assetId: null,
  }),
  animations: z.array(animationSchema).max(20).default([]),
});
export const lightSchema = z.strictObject({
  id,
  type: z.enum(['ambient', 'hemisphere', 'directional', 'point', 'spot']),
  color,
  intensity: finite.min(0).max(10),
  position: vec3,
});
export const cameraSchema = z.strictObject({
  type: z.literal('perspective'),
  position: vec3,
  target: vec3,
  fov: finite.min(15).max(100),
});
export const environmentSchema = z.strictObject({
  ground: z.boolean(),
  groundColor: color,
  sky: z.boolean().default(false),
  fog: z.strictObject({
    enabled: z.boolean(),
    color,
    near: finite.min(0.1).max(9999),
    far: finite.min(0.2).max(10000),
  }),
  effects: z
    .array(
      z.strictObject({
        id,
        type: z.enum(['rain', 'particles']),
        intensity: finite.min(0).max(1),
      }),
    )
    .max(4),
});
export const settingsSchema = z.strictObject({
  durationSeconds: finite.min(0.1).max(300),
  loop: z.boolean(),
  background: color,
  quality: z.enum(['low', 'medium', 'high']),
});
export const sceneSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    metadata: z.strictObject({
      title: z.string().min(1).max(120),
      description: z.string().max(1000),
      style: z.string().max(80),
    }),
    settings: settingsSchema,
    camera: cameraSchema,
    environment: environmentSchema,
    lights: z.array(lightSchema).max(20),
    objects: z.array(objectSchema).max(100),
  })
  .superRefine((scene, ctx) => {
    const all = new Set<string>();
    const objects = new Map(scene.objects.map((o) => [o.id, o]));
    let tracks = 0;
    let particles = 0;
    for (const entry of [
      ...scene.objects,
      ...scene.lights,
      ...scene.environment.effects,
      ...scene.objects.flatMap((o) => o.animations),
    ]) {
      if (all.has(entry.id))
        ctx.addIssue({ code: 'custom', message: `Duplicate ID: ${entry.id}` });
      all.add(entry.id);
    }
    if (scene.environment.fog.near >= scene.environment.fog.far)
      ctx.addIssue({
        code: 'custom',
        message: 'Fog near must be less than far.',
      });
    if (scene.camera.position.every((n, i) => n === scene.camera.target[i]))
      ctx.addIssue({
        code: 'custom',
        message: 'Camera position and target must differ.',
      });
    for (const o of scene.objects) {
      let parent = o.parentId;
      const seen = new Set([o.id]);
      while (parent) {
        if (seen.has(parent)) {
          ctx.addIssue({ code: 'custom', message: 'Parent cycle detected.' });
          break;
        }
        seen.add(parent);
        const p = objects.get(parent);
        if (!p) {
          ctx.addIssue({ code: 'custom', message: 'Invalid parent ID.' });
          break;
        }
        parent = p.parentId;
      }
      tracks += o.animations.length;
      if (o.type === 'particles') particles += o.properties.count;
      if (o.type === 'asset' && !o.properties.assetId)
        ctx.addIssue({
          code: 'custom',
          message: 'Asset object requires an approved asset ID.',
        });
      for (const a of o.animations) {
        if (a.type === 'dance' && o.type !== 'procedural_robot')
          ctx.addIssue({
            code: 'custom',
            message: 'Dance requires a procedural robot.',
          });
        if (
          a.type === 'keyframe' &&
          (a.keyframes.length < 2 ||
            a.keyframes.some(
              (k, i) => i > 0 && k.time <= a.keyframes[i - 1]!.time,
            ))
        )
          ctx.addIssue({
            code: 'custom',
            message: 'Keyframes need at least two strictly increasing times.',
          });
        if (
          a.property === 'scale' &&
          a.type === 'keyframe' &&
          a.keyframes.some((k) => k.value.some((n) => n < 0.01 || n > 100))
        )
          ctx.addIssue({
            code: 'custom',
            message: 'Scale keyframes must be positive and bounded.',
          });
      }
    }
    if (tracks > 200 || particles > 5000)
      ctx.addIssue({
        code: 'custom',
        message: 'Scene track or particle budget exceeded.',
      });
  });
export type Scene = z.infer<typeof sceneSchema>;
export type SceneObject = z.infer<typeof objectSchema>;
export type Animation = z.infer<typeof animationSchema>;
export type Transform = z.infer<typeof transformSchema>;
export function validateScene(
  input: unknown,
  approvedAssets: ReadonlySet<string> = new Set(),
): Scene {
  const scene = sceneSchema.parse(input);
  for (const o of scene.objects)
    if (o.properties.assetId && !approvedAssets.has(o.properties.assetId))
      throw new Error(
        'ASSET_MISSING: import or restore the referenced local asset.',
      );
  return scene;
}
export function migrateScene(
  input: unknown,
  approvedAssets: ReadonlySet<string> = new Set(),
) {
  return validateScene(input, approvedAssets);
}
export function makeObject(
  type: SceneObject['type'],
  name: string,
  objectId = `obj_${crypto.randomUUID()}`,
): SceneObject {
  return objectSchema.parse({
    id: objectId,
    name,
    type,
    transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
    material: {},
  });
}
