import { useEffect, useRef, useState } from 'react';
import { Box, Camera, Maximize2, RotateCcw } from 'lucide-react';
import { SceneRuntime } from '@scenecraft/scene-runtime';
import { useEditor } from '../../state/editor';
import { listAssets } from '../../state/storage';
export function Viewport() {
  const container = useRef<HTMLDivElement>(null);
  const runtime = useRef<SceneRuntime | null>(null);
  const scene = useEditor((s) => s.scene),
    selected = useEditor((s) => s.selectedId),
    quality = useEditor((s) => s.quality),
    speed = useEditor((s) => s.speed);
  const select = useEditor((s) => s.select),
    tick = useEditor((s) => s.tick),
    [error, setError] = useState('');
  const callbacks = useRef({ scene, select, tick });
  callbacks.current = { scene, select, tick };
  const playing = useEditor((s) => s.playing);
  useEffect(() => {
    if (!container.current) return;
    let instance: SceneRuntime | null = null;
    let alive = true;
    void listAssets()
      .then((assets) => {
        if (!alive || !container.current) return;
        instance = new SceneRuntime({
          assets: new Map(assets.map((asset) => [asset.id, asset.blob])),
          onSelect: (id) => callbacks.current.select(id),
          onTime: (time, isPlaying) => callbacks.current.tick(time, isPlaying),
          onError: (message) => queueMicrotask(() => setError(message)),
        });
        instance.mount(container.current, callbacks.current.scene);
        runtime.current = instance;
      })
      .catch((e) =>
        queueMicrotask(() =>
          setError(e instanceof Error ? e.message : 'WebGL is unavailable.'),
        ),
      );
    return () => {
      alive = false;
      instance?.dispose();
      runtime.current = null;
    };
  }, []);
  useEffect(() => {
    try {
      runtime.current?.updateScene(scene);
      queueMicrotask(() => setError(''));
    } catch (e) {
      queueMicrotask(() =>
        setError(e instanceof Error ? e.message : 'The scene is invalid.'),
      );
    }
  }, [scene]);
  useEffect(() => runtime.current?.setQuality(quality), [quality]);
  useEffect(() => {
    if (playing) runtime.current?.play();
    else runtime.current?.pause();
  }, [playing]);
  useEffect(() => runtime.current?.setSpeed(speed), [speed]);
  return (
    <section className="viewport-live" aria-label="3D viewport">
      <div className="viewport-toolbar">
        <span>
          <Box size={14} /> Scene preview
        </span>
        <div>
          <button
            aria-label="Reset camera"
            title="Reset camera"
            onClick={() => runtime.current?.resetCamera()}
          >
            <RotateCcw size={15} />
          </button>
          <button
            aria-label="Frame selected object"
            disabled={!selected}
            title="Frame selected object"
            onClick={() => selected && runtime.current?.frameObject(selected)}
          >
            <Maximize2 size={15} />
          </button>
          <button
            aria-label="Capture scene thumbnail"
            title="Capture scene thumbnail"
            onClick={() => {
              const image = runtime.current?.captureThumbnail();
              if (image) {
                const a = document.createElement('a');
                a.href = image;
                a.download = 'scene-thumbnail.png';
                a.click();
              }
            }}
          >
            <Camera size={15} />
          </button>
        </div>
      </div>
      <div className="viewport-canvas" ref={container}>
        <div
          className={`renderer-message ${error ? 'visible' : ''}`}
          role="status"
        >
          {error || 'Loading 3D scene…'}
        </div>
      </div>
      {error && <p className="renderer-warning">{error}</p>}
      <div className="viewport-footer">
        <span>Orbit · scroll to zoom · click an object to select</span>
        <span>
          {scene.objects.length} objects · {scene.settings.quality} quality
        </span>
      </div>
    </section>
  );
}
