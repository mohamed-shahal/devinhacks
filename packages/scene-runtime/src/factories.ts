import * as T from 'three';
import type { SceneObject } from '@scenecraft/scene-schema';
export function material(o: SceneObject) {
  const p = {
    color: o.material.color,
    transparent: o.material.opacity < 1,
    opacity: o.material.opacity,
  };
  return o.material.type === 'basic'
    ? new T.MeshBasicMaterial(p)
    : new T.MeshStandardMaterial({
        ...p,
        roughness: o.material.roughness,
        metalness: o.material.metalness,
        emissive: o.material.emissive,
      });
}
function mesh(
  geometry: T.BufferGeometry,
  mat: T.Material,
  position: [number, number, number] = [0, 0, 0],
) {
  const m = new T.Mesh(geometry, mat);
  m.position.set(...position);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}
export function particleCloud(count: number, color: string) {
  const p = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    p[i * 3] = Math.sin(i * 127.1) * 12;
    p[i * 3 + 1] = ((i * 0.173) % 1) * 12;
    p[i * 3 + 2] = Math.sin(i * 311.7) * 12;
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.BufferAttribute(p, 3));
  const cloud = new T.Points(
    g,
    new T.PointsMaterial({
      color,
      size: 0.035,
      transparent: true,
      opacity: 0.65,
    }),
  );
  cloud.userData.initial = p.slice();
  return cloud;
}
export function createObject(o: SceneObject): T.Object3D {
  const p = o.properties;
  const mat = material(o);
  const root = new T.Group();
  const accent = new T.MeshStandardMaterial({
    color: p.accentColor,
    emissive: p.accentColor,
    emissiveIntensity: 0.6,
  });
  if (o.type === 'procedural_robot') {
    const body = new T.MeshStandardMaterial({
      color: p.bodyColor,
      metalness: 0.65,
      roughness: 0.3,
    });
    root.add(
      mesh(new T.BoxGeometry(0.8, 0.85, 0.5), body, [0, 1.35, 0]),
      mesh(new T.BoxGeometry(0.75, 0.55, 0.55), body, [0, 2.12, 0]),
      mesh(new T.BoxGeometry(0.55, 0.12, 0.05), accent, [0, 1.48, 0.27]),
    );
    const eye = new T.MeshBasicMaterial({ color: p.eyeColor });
    for (const x of [-0.2, 0.2])
      root.add(mesh(new T.SphereGeometry(0.07, 12, 8), eye, [x, 2.15, 0.3]));
    for (const sign of [-1, 1]) {
      const arm = new T.Group();
      arm.name = `arm_${sign}`;
      arm.position.set(sign * 0.58, 1.65, 0);
      arm.add(
        mesh(new T.CapsuleGeometry(0.12, 0.55, 4, 8), body, [0, -0.3, 0]),
        mesh(new T.SphereGeometry(0.15, 12, 8), accent),
      );
      root.add(arm);
      const leg = new T.Group();
      leg.name = `leg_${sign}`;
      leg.position.set(sign * 0.22, 0.95, 0);
      leg.add(
        mesh(new T.CapsuleGeometry(0.14, 0.5, 4, 8), body, [0, -0.35, 0]),
        mesh(new T.BoxGeometry(0.32, 0.18, 0.5), body, [0, -0.8, 0.08]),
      );
      root.add(leg);
    }
    mat.dispose();
  } else if (o.type === 'procedural_tree') {
    root.add(
      mesh(
        new T.CylinderGeometry(0.12, 0.2, 1.5, 8),
        new T.MeshStandardMaterial({ color: '#836b58' }),
        [0, 0.75, 0],
      ),
    );
    for (let i = 0; i < 3; i++)
      root.add(
        mesh(new T.ConeGeometry(1 - i * 0.2, 1.5, 7), mat, [
          0,
          1.5 + i * 0.6,
          0,
        ]),
      );
  } else if (o.type === 'procedural_building') {
    root.add(mesh(new T.BoxGeometry(1.4, 3, 1.3), mat, [0, 1.5, 0]));
    for (let y = 0; y < 6; y++)
      for (const x of [-0.4, 0, 0.4])
        root.add(
          mesh(new T.BoxGeometry(0.16, 0.18, 0.02), accent, [
            x,
            0.4 + y * 0.45,
            0.66,
          ]),
        );
  } else if (o.type === 'particles') {
    mat.dispose();
    root.add(particleCloud(p.count, p.accentColor));
  } else if (o.type === 'asset') {
    mat.wireframe = true;
    root.add(mesh(new T.BoxGeometry(), mat));
  } else if (o.type !== 'group') {
    let g: T.BufferGeometry;
    switch (o.type) {
      case 'sphere':
        g = new T.SphereGeometry(p.radius, 24, 16);
        break;
      case 'capsule':
        g = new T.CapsuleGeometry(p.radius, p.height, 6, 12);
        break;
      case 'cylinder':
        g = new T.CylinderGeometry(p.radius, p.radius, p.height, 24);
        break;
      case 'cone':
        g = new T.ConeGeometry(p.radius, p.height, 24);
        break;
      case 'torus':
        g = new T.TorusGeometry(p.radius, 0.12, 12, 32);
        break;
      case 'plane':
        g = new T.PlaneGeometry(p.width, p.height);
        break;
      default:
        g = new T.BoxGeometry(p.width, p.height, p.depth);
    }
    root.add(mesh(g, mat));
  } else mat.dispose();
  if (o.type !== 'procedural_building') accent.dispose();
  root.userData.objectId = o.id;
  root.name = o.name;
  return root;
}
export function disposeObject(root: T.Object3D) {
  const geometries = new Set<T.BufferGeometry>();
  const materials = new Set<T.Material>();
  const textures = new Set<T.Texture>();
  root.traverse((o) => {
    if (o instanceof T.Mesh || o instanceof T.Points || o instanceof T.Line) {
      geometries.add(o.geometry);
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        materials.add(m);
        for (const value of Object.values(m))
          if (value instanceof T.Texture) textures.add(value);
      }
    }
  });
  for (const t of textures) {
    const image = t.source.data;
    if (typeof ImageBitmap !== 'undefined' && image instanceof ImageBitmap)
      image.close();
    t.dispose();
  }
  for (const m of materials) m.dispose();
  for (const g of geometries) g.dispose();
}
