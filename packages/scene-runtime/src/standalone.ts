import { SceneRuntime } from './index';
import type { Scene } from '@scenecraft/scene-schema';

export function mount(scene: Scene, container: HTMLElement) {
  const runtime = new SceneRuntime();
  runtime.mount(container, scene);
  return runtime;
}
