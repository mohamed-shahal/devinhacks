import { animationSchema, makeObject, sceneSchema } from './schema';
import type { Scene, SceneObject } from './schema';
export const presetNames = [
  'Neon robot',
  'Glowing forest',
  'Alien planet',
  'Studio stage',
  'Abstract motion',
] as const;
export type PresetName = (typeof presetNames)[number];
export function preset(name: PresetName): Scene {
  const s: Scene = sceneSchema.parse({
    schemaVersion: 1,
    metadata: {
      title: name,
      description: 'Local procedural template. Editable and exportable.',
      style: 'stylized',
    },
    settings: {
      durationSeconds: 8,
      loop: true,
      background: '#0c1225',
      quality: 'medium',
    },
    camera: {
      type: 'perspective',
      position: [7, 5, 8],
      target: [0, 1, 0],
      fov: 45,
    },
    environment: {
      ground: true,
      groundColor: '#152033',
      sky: false,
      fog: { enabled: false, color: '#10152e', near: 15, far: 55 },
      effects: [],
    },
    lights: [
      {
        id: 'ambient',
        type: 'hemisphere',
        color: '#b9d7ff',
        intensity: 1.5,
        position: [0, 6, 0],
      },
      {
        id: 'key',
        type: 'directional',
        color: '#c8e7ff',
        intensity: 3,
        position: [4, 8, 4],
      },
      {
        id: 'rim',
        type: 'point',
        color: '#bf75ff',
        intensity: 8,
        position: [-3, 3, -2],
      },
    ],
    objects: [],
  });
  function add(
    type: SceneObject['type'],
    id: string,
    position: [number, number, number],
    color: string,
    scale: [number, number, number] = [1, 1, 1],
  ) {
    const o = makeObject(type, id, id);
    o.transform.position = position;
    o.transform.scale = scale;
    o.material.color = color;
    s.objects.push(o);
    return o;
  }
  if (name === 'Neon robot') {
    const robot = add('procedural_robot', 'Robot', [0, 0, 0], '#b9c9df');
    robot.animations.push(
      animationSchema.parse({ id: 'dance', type: 'dance', amplitude: 0.5 }),
    );
    s.environment.effects = [{ id: 'rain', type: 'rain', intensity: 0.45 }];
    s.environment.fog.enabled = true;
    for (let i = 0; i < 8; i++) {
      const b = add(
        'procedural_building',
        `Building_${i}`,
        [((i % 4) - 1.5) * 3, 0, i < 4 ? -4 : 4],
        '#1b2845',
        [1, 1 + (i % 3) * 0.5, 1],
      );
      b.properties.accentColor = i % 2 ? '#bd70ee' : '#4de6de';
    }
    const stage = add(
      'cylinder',
      'Dance_stage',
      [0, 0.08, 0],
      '#20344e',
      [2.3, 0.15, 2.3],
    );
    stage.material.metalness = 0.7;
  }
  if (name === 'Glowing forest') {
    s.settings.background = '#071d26';
    s.environment.groundColor = '#173a35';
    s.lights[2]!.color = '#72ffd0';
    for (let i = 0; i < 12; i++) {
      const a = i * 2.4;
      add(
        'procedural_tree',
        `Tree_${i}`,
        [Math.cos(a) * (3 + (i % 3)), 0, Math.sin(a) * (3 + (i % 3))],
        '#4da58c',
        [0.8 + (i % 3) * 0.3, 1 + (i % 4) * 0.2, 0.8],
      );
    }
    for (let i = 0; i < 7; i++) {
      const m = add(
        'sphere',
        `Mushroom_${i}`,
        [Math.sin(i * 3) * 2, 1 + (i % 3) * 0.3, Math.cos(i * 3) * 2],
        '#bd9cff',
        [0.5, 0.22, 0.5],
      );
      m.material.emissive = '#49316b';
      m.animations.push(
        animationSchema.parse({
          id: `float_${i}`,
          type: 'bob',
          amplitude: 0.25,
          durationSeconds: 3 + i * 0.2,
        }),
      );
      add(
        'cylinder',
        `Stem_${i}`,
        [m.transform.position[0], 0.4, m.transform.position[2]],
        '#a9d7c7',
        [0.12, 0.8, 0.12],
      );
    }
  }
  if (name === 'Alien planet') {
    s.settings.background = '#1e1433';
    s.environment.groundColor = '#6b4761';
    s.environment.sky = true;
    add('procedural_robot', 'Astronaut', [0, 0, 0], '#eeeeff').animations.push(
      animationSchema.parse({
        id: 'low_gravity',
        type: 'bob',
        amplitude: 0.6,
        durationSeconds: 6,
      }),
    );
    for (let i = 0; i < 10; i++) {
      const r = add(
        'sphere',
        `Rock_${i}`,
        [Math.sin(i * 2) * 5, 0.2, Math.cos(i * 2) * 5],
        '#af718b',
        [0.5 + (i % 2) * 0.5, 0.3, 0.6],
      );
      r.material.roughness = 1;
    }
    add('sphere', 'Moon', [-6, 7, -10], '#edc49a', [2, 2, 2]);
  }
  if (name === 'Studio stage') {
    s.settings.background = '#263348';
    s.environment.groundColor = '#34465c';
    add(
      'procedural_robot',
      'Studio_robot',
      [0, 0, 0],
      '#aebed3',
    ).animations.push(
      animationSchema.parse({
        id: 'pose',
        type: 'rotate',
        amplitude: Math.PI * 2,
        durationSeconds: 12,
      }),
    );
    add('cylinder', 'Pedestal', [0, -0.1, 0], '#576c85', [2, 0.2, 2]);
  }
  if (name === 'Abstract motion') {
    s.environment.ground = false;
    s.settings.background = '#101d32';
    for (let i = 0; i < 7; i++) {
      const o = add(
        i % 3 === 0 ? 'torus' : i % 3 === 1 ? 'box' : 'sphere',
        `Shape_${i}`,
        [Math.sin(i * 2) * 2.8, 1.5 + Math.cos(i) * 0.8, Math.cos(i * 2) * 2.8],
        ['#c4b0f5', '#67d9d2', '#edb599'][i % 3]!,
        [0.8, 0.8, 0.8],
      );
      o.animations.push(
        animationSchema.parse({
          id: `spin_${i}`,
          type: 'rotate',
          axis: i % 2 ? 'x' : 'y',
          amplitude: Math.PI * 2,
          durationSeconds: 5 + i,
        }),
      );
      o.animations.push(
        animationSchema.parse({
          id: `bob_${i}`,
          type: 'bob',
          amplitude: 0.3,
          durationSeconds: 3 + i * 0.3,
        }),
      );
    }
  }
  return sceneSchema.parse(s);
}
export function demoGenerate(prompt: string): Scene {
  if (/robot|cyberpunk|neon|dance/i.test(prompt)) return preset('Neon robot');
  if (/forest|mushroom|tree/i.test(prompt)) return preset('Glowing forest');
  if (/alien|astronaut|planet/i.test(prompt)) return preset('Alien planet');
  if (/abstract|geometric|shapes/i.test(prompt))
    return preset('Abstract motion');
  if (/studio|stage/i.test(prompt)) return preset('Studio stage');
  throw new Error(
    'Demo supports robot, forest, alien planet, studio stage and abstract prompts. Choose a template or configure a real model.',
  );
}
