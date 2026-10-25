import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { applyPatch, validateScene } from '@scenecraft/scene-schema';
import type { Scene, ScenePatch } from '@scenecraft/scene-schema';
import { createObject, disposeObject, particleCloud } from './factories';
import { evaluateTransform, PlaybackClock, progress } from './animation';
export type RuntimeOptions = {
  onSelect?: (id: string | null) => void;
  onTime?: (time: number, playing: boolean) => void;
  onError?: (message: string) => void;
  assets?: Map<string, Blob>;
  cinematic?: boolean;
  /** Fixed pixel ratio for video exports with exact output dimensions. */
  pixelRatio?: number;
};
export class SceneRuntime {
  readonly clock = new PlaybackClock();
  private renderer: T.WebGLRenderer | null = null;
  private scene = new T.Scene();
  private studioEnvironment: T.WebGLRenderTarget | null = null;
  private camera = new T.PerspectiveCamera(45, 1, 0.1, 20000);
  private shotRoll = 0;
  private controls: OrbitControls | null = null;
  private frame = 0;
  private last = 0;
  private reported = 0;
  private observer: ResizeObserver | null = null;
  private spec: Scene | null = null;
  private objects = new Map<string, T.Object3D>();
  private clouds: T.Points[] = [];
  private selection: T.BoxHelper | null = null;
  private generation = 0;
  private dead = false;
  private pointerStart = [0, 0];
  constructor(private options: RuntimeOptions = {}) {}
  mount(container: HTMLElement, spec: Scene) {
    try {
      this.renderer = new T.WebGLRenderer({
        antialias: true,
        alpha: false,
        preserveDrawingBuffer: true,
      });
    } catch {
      throw new Error(
        'WebGL 2 is unavailable. Enable hardware acceleration or use a supported browser. Your scene data is safe.',
      );
    }
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    if (this.options.cinematic) {
      this.renderer.toneMappingExposure = 1.15;
      const room = new RoomEnvironment();
      const pmrem = new T.PMREMGenerator(this.renderer);
      this.studioEnvironment = pmrem.fromScene(room, 0.04);
      this.scene.environment = this.studioEnvironment.texture;
      this.scene.environmentIntensity = 0.25;
      room.dispose();
      pmrem.dispose();
    }
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.PCFShadowMap;
    container.append(this.renderer.domElement);
    this.renderer.domElement.setAttribute('aria-label', 'Interactive 3D scene');
    this.renderer.domElement.setAttribute('role', 'img');
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.maxDistance = 500;
    this.renderer.domElement.addEventListener('pointerdown', this.down);
    this.renderer.domElement.addEventListener('pointerup', this.pick);
    this.renderer.domElement.addEventListener('webglcontextlost', this.lost);
    this.renderer.domElement.addEventListener(
      'webglcontextrestored',
      this.restored,
    );
    document.addEventListener('visibilitychange', this.visible);
    this.observer = new ResizeObserver(() =>
      this.resize(container.clientWidth, container.clientHeight),
    );
    this.observer.observe(container);
    this.updateScene(spec);
    this.last = performance.now();
    this.frame = requestAnimationFrame(this.animate);
  }
  updateScene(input: Scene) {
    const spec = validateScene(input, new Set(this.options.assets?.keys()));
    const cameraChanged =
      !this.spec ||
      JSON.stringify(this.spec.camera) !== JSON.stringify(spec.camera);
    this.spec = spec;
    this.generation++;
    const token = this.generation;
    this.select(null);
    disposeObject(this.scene);
    this.scene.clear();
    this.objects.clear();
    this.clouds = [];
    this.scene.background = new T.Color(spec.settings.background);
    this.scene.fog = spec.environment.fog.enabled
      ? new T.Fog(
          spec.environment.fog.color,
          spec.environment.fog.near,
          spec.environment.fog.far,
        )
      : null;
    if (spec.environment.ground) {
      const ground = new T.Mesh(
        new T.PlaneGeometry(100, 100),
        new T.MeshStandardMaterial({
          color: spec.environment.groundColor,
          roughness: 0.7,
          metalness: 0.2,
        }),
      );
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = -0.13;
      ground.receiveShadow = true;
      this.scene.add(ground);
      if (!this.options.cinematic) {
        const grid = new T.GridHelper(40, 40, '#466177', '#263b4c');
        grid.position.y = -0.12;
        this.scene.add(grid);
      }
    }
    for (const l of spec.lights) {
      let light: T.Light;
      switch (l.type) {
        case 'ambient':
          light = new T.AmbientLight(l.color, l.intensity);
          break;
        case 'hemisphere':
          light = new T.HemisphereLight(l.color, '#24213a', l.intensity);
          break;
        case 'directional':
          light = new T.DirectionalLight(l.color, l.intensity);
          break;
        case 'spot':
          light = new T.SpotLight(l.color, l.intensity * 15, 100, Math.PI / 4);
          break;
        default:
          light = new T.PointLight(l.color, l.intensity * 8, 100, 2);
      }
      light.position.set(...l.position);
      if (
        light instanceof T.DirectionalLight &&
        !this.scene.children.some((x) => x instanceof T.DirectionalLight)
      ) {
        light.castShadow = true;
        light.shadow.mapSize.set(
          this.options.cinematic ? 2048 : 1024,
          this.options.cinematic ? 2048 : 1024,
        );
        if (this.options.cinematic) {
          light.shadow.camera.left = -15;
          light.shadow.camera.right = 15;
          light.shadow.camera.top = 15;
          light.shadow.camera.bottom = -15;
          light.shadow.normalBias = 0.03;
        }
      }
      this.scene.add(light);
    }
    for (const o of spec.objects) {
      const root = createObject(o);
      root.visible = o.visible;
      this.objects.set(o.id, root);
      if (o.type === 'particles')
        root.traverse((x) => {
          if (x instanceof T.Points) this.clouds.push(x);
        });
      if (o.type === 'asset' && o.properties.assetId) {
        const blob = this.options.assets?.get(o.properties.assetId);
        if (blob) {
          const manager = new T.LoadingManager();
          manager.setURLModifier((url) => {
            if (
              !/^(data:(application\/(octet-stream|gltf-buffer)|image\/(png|jpeg|webp));base64,|blob:)/.test(
                url,
              )
            )
              throw new Error('Remote resources are blocked.');
            return url;
          });
          void blob
            .arrayBuffer()
            .then((data) =>
              new GLTFLoader(manager).parseAsync(
                blob.type === 'model/gltf+json'
                  ? new TextDecoder().decode(data)
                  : data,
                '',
              ),
            )
            .then((gltf) => {
              if (this.dead || token !== this.generation) {
                disposeObject(gltf.scene);
                return;
              }
              disposeObject(root);
              root.clear();
              root.add(gltf.scene);
            })
            .catch(() =>
              this.options.onError?.(
                'A local model could not be rendered. Re-import a self-contained GLB/GLTF asset.',
              ),
            );
        }
      }
    }
    for (const o of spec.objects) {
      const root = this.objects.get(o.id)!;
      (o.parentId ? this.objects.get(o.parentId)! : this.scene).add(root);
    }
    let budget = Math.max(
      0,
      5000 -
        spec.objects
          .filter((o) => o.type === 'particles')
          .reduce((n, o) => n + o.properties.count, 0),
    );
    for (const e of spec.environment.effects) {
      const count = Math.min(budget, Math.floor(e.intensity * 1200));
      budget -= count;
      const cloud = particleCloud(
        count,
        e.type === 'rain' ? '#accde6' : '#d3b9ff',
      );
      cloud.userData.rain = e.type === 'rain';
      this.scene.add(cloud);
      this.clouds.push(cloud);
    }
    this.clock.duration = spec.settings.durationSeconds;
    this.clock.loop = spec.settings.loop;
    this.clock.seek(this.clock.time);
    this.setQuality(spec.settings.quality);
    if (cameraChanged) this.resetCamera();
    this.evaluate();
  }
  applyPatch(patch: ScenePatch, revision: number) {
    if (this.spec)
      this.updateScene(
        applyPatch(
          this.spec,
          patch,
          revision,
          new Set(this.options.assets?.keys()),
        ),
      );
  }
  private evaluate() {
    if (!this.spec) return;
    for (const o of this.spec.objects) {
      const root = this.objects.get(o.id)!;
      const t = evaluateTransform(o.transform, o.animations, this.clock.time);
      root.position.set(...t.position);
      root.rotation.set(...t.rotation);
      root.scale.set(...t.scale);
      for (const a of o.animations) {
        if (!a.enabled) continue;
        if (a.type === 'dance')
          for (const sign of [-1, 1]) {
            const arm = root.getObjectByName(`arm_${sign}`),
              leg = root.getObjectByName(`leg_${sign}`);
            const w = Math.sin(progress(a, this.clock.time) * Math.PI * 2);
            if (arm) arm.rotation.z = sign * (0.3 + w * a.amplitude);
            if (leg) leg.rotation.x = w * a.amplitude * sign * 0.5;
          }
        if (a.type === 'camera_orbit') {
          const p = progress(a, this.clock.time) * Math.PI * 2;
          this.camera.position.set(Math.sin(p) * 8, 4, Math.cos(p) * 8);
          this.camera.lookAt(...this.spec.camera.target);
        }
        if (a.type === 'camera_dolly') {
          const p = progress(a, this.clock.time);
          this.camera.position.set(
            ...(a.from.map((n, i) => n + (a.to[i]! - n) * p) as [
              number,
              number,
              number,
            ]),
          );
          this.camera.lookAt(...this.spec.camera.target);
        }
      }
    }
    for (const cloud of this.clouds) {
      const p = cloud.geometry.getAttribute('position');
      const initial = cloud.userData.initial as Float32Array;
      for (let i = 0; i < p.count; i++)
        p.setY(
          i,
          (((initial[i * 3 + 1]! -
            this.clock.time * (cloud.userData.rain ? 5 : 1)) %
            12) +
            12) %
            12,
        );
      p.needsUpdate = true;
    }
    this.selection?.update();
  }
  private animate = (now: number) => {
    if (this.dead) return;
    this.clock.tick((now - this.last) / 1000);
    this.last = now;
    if (!document.hidden) {
      this.evaluate();
      this.controls?.update();
      this.renderer?.render(this.scene, this.camera);
    }
    if (now - this.reported > 80) {
      this.options.onTime?.(this.clock.time, this.clock.playing);
      this.reported = now;
    }
    this.frame = requestAnimationFrame(this.animate);
  };
  private down = (e: PointerEvent) => {
    this.pointerStart = [e.clientX, e.clientY];
  };
  private pick = (e: PointerEvent) => {
    if (
      Math.hypot(
        e.clientX - this.pointerStart[0]!,
        e.clientY - this.pointerStart[1]!,
      ) > 5 ||
      !this.renderer
    )
      return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ray = new T.Raycaster();
    ray.setFromCamera(
      new T.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        (-(e.clientY - rect.top) / rect.height) * 2 + 1,
      ),
      this.camera,
    );
    const hits = ray.intersectObjects([...this.objects.values()], true);
    let found: string | null = null;
    for (const hit of hits) {
      let o: T.Object3D | null = hit.object;
      while (o && !o.userData.objectId) o = o.parent;
      if (o) {
        found = String(o.userData.objectId);
        break;
      }
    }
    this.select(found);
    this.options.onSelect?.(found);
  };
  select(id: string | null) {
    if (this.selection) {
      this.scene.remove(this.selection);
      this.selection.geometry.dispose();
      this.selection.material.dispose();
      this.selection = null;
    }
    const target = id ? this.objects.get(id) : null;
    if (target) {
      this.selection = new T.BoxHelper(target, '#c3b5f3');
      this.scene.add(this.selection);
    }
  }
  frameObject(id: string) {
    const root = this.objects.get(id);
    if (!root || !this.controls) return;
    const box = new T.Box3().setFromObject(root);
    const center = box.getCenter(new T.Vector3());
    const radius = Math.max(1, box.getSize(new T.Vector3()).length());
    this.camera.position
      .copy(center)
      .add(new T.Vector3(radius, radius * 0.7, radius));
    this.controls.target.copy(center);
    this.controls.update();
  }
  resetCamera() {
    if (!this.spec) return;
    this.camera.position.set(...this.spec.camera.position);
    this.camera.fov = this.spec.camera.fov;
    this.camera.updateProjectionMatrix();
    this.controls?.target.set(...this.spec.camera.target);
    this.controls?.update();
  }
  play() {
    this.clock.playing = true;
  }
  pause() {
    this.clock.playing = false;
  }
  reset() {
    this.clock.reset();
    this.evaluate();
    this.options.onTime?.(0, false);
  }
  seek(time: number) {
    this.clock.seek(time);
    this.evaluate();
  }
  setSpeed(speed: number) {
    this.clock.speed = Math.max(0.25, Math.min(2, speed));
  }
  setQuality(q: Scene['settings']['quality']) {
    this.renderer?.setPixelRatio(
      this.options.pixelRatio ??
        Math.min(devicePixelRatio, q === 'low' ? 1 : q === 'medium' ? 1.5 : 2),
    );
    if (this.renderer) this.renderer.shadowMap.enabled = q !== 'low';
  }
  resize(width: number, height: number) {
    if (!width || !height) return;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer?.setSize(width, height, false);
  }
  captureThumbnail() {
    return this.renderer?.domElement.toDataURL('image/png') ?? null;
  }
  getCanvas() {
    return this.renderer?.domElement ?? null;
  }
  setCinematicCamera(
    angle: string,
    movement: string,
    progress: number,
    shotIndex = 0,
    focusId?: string | null,
  ) {
    const target = new T.Vector3(...(this.spec?.camera.target ?? [0, 1, 0]));
    const subject = focusId ? this.objects.get(focusId) : undefined;
    let subjectRadius = 1.4;
    if (subject) {
      const bounds = new T.Box3().setFromObject(subject);
      if (!bounds.isEmpty()) {
        bounds.getCenter(target);
        subjectRadius = Math.max(
          0.5,
          Math.min(12, bounds.getSize(new T.Vector3()).length() / 2),
        );
      }
    }
    const t = Math.max(0, Math.min(1, progress));
    const smooth = t * t * (3 - 2 * t);
    const shot = [
      { distance: 13, elevation: 0.28, azimuth: -0.55 },
      { distance: 7, elevation: 0.12, azimuth: 0.25 },
      { distance: 8, elevation: 1.55, azimuth: -0.2 },
      { distance: 8, elevation: 0.2, azimuth: 1.4 },
      { distance: 3.5, elevation: 0.3, azimuth: -0.15 },
      { distance: 7, elevation: 0.35, azimuth: 0.5 },
    ][
      Math.max(
        0,
        [
          'Wide establishing',
          'Low-angle hero',
          'Overhead top-down',
          'Profile tracking',
          'Tight cinematic close-up',
          'Dutch angle',
        ].indexOf(angle),
      ) % 6
    ]!;
    const movementName = movement.toLowerCase();
    const plannedDistance = this.spec
      ? new T.Vector3(...this.spec.camera.position).distanceTo(target)
      : 13;
    const framing = subject
      ? subjectRadius / 1.4
      : Math.max(0.5, Math.min(3, plannedDistance / 13));
    let distance = shot.distance * framing;
    let azimuth = shot.azimuth + shotIndex * 0.16;
    let elevation = shot.elevation;
    if (movementName.includes('dolly in')) distance *= 1.2 - smooth * 0.38;
    else if (movementName.includes('pull back'))
      distance *= 0.7 + smooth * 0.58;
    else if (movementName.includes('orbit')) azimuth += smooth * 0.85;
    else if (movementName.includes('tracking')) azimuth += (smooth - 0.5) * 0.6;
    else if (movementName.includes('crane')) elevation += smooth * 0.25;
    const horizontal = Math.cos(elevation) * distance;
    this.camera.position.set(
      target.x + Math.sin(azimuth) * horizontal,
      target.y + Math.sin(elevation) * distance,
      target.z + Math.cos(azimuth) * horizontal,
    );
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(target);
    this.shotRoll = angle === 'Dutch angle' ? -0.12 + smooth * 0.24 : 0;
    this.camera.rotateZ(this.shotRoll);
    this.controls?.target.copy(target);
    if (this.controls) this.controls.enabled = false;
  }
  renderFrame() {
    this.renderer?.render(this.scene, this.camera);
  }
  private visible = () => {
    this.last = performance.now();
  };
  private lost = (e: Event) => {
    e.preventDefault();
    this.pause();
    this.options.onError?.(
      'Graphics context lost. Your scene is safe; waiting for recovery.',
    );
  };
  private restored = () => {
    if (this.spec) this.updateScene(this.spec);
    this.options.onError?.('');
  };
  dispose() {
    this.dead = true;
    this.generation++;
    cancelAnimationFrame(this.frame);
    this.observer?.disconnect();
    document.removeEventListener('visibilitychange', this.visible);
    const canvas = this.renderer?.domElement;
    canvas?.removeEventListener('pointerdown', this.down);
    canvas?.removeEventListener('pointerup', this.pick);
    canvas?.removeEventListener('webglcontextlost', this.lost);
    canvas?.removeEventListener('webglcontextrestored', this.restored);
    this.controls?.dispose();
    this.select(null);
    disposeObject(this.scene);
    this.scene.clear();
    this.studioEnvironment?.dispose();
    this.renderer?.dispose();
    this.renderer?.forceContextLoss();
    canvas?.remove();
    this.objects.clear();
  }
}
