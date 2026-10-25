import { zipSync, strToU8 } from 'fflate';
import { sceneSchema } from '@scenecraft/scene-schema';
import type { Scene } from '@scenecraft/scene-schema';
import { listAssets } from '../state/storage';
import type { Project } from '../state/storage';
function download(data: Blob, name: string) {
  const url = URL.createObjectURL(data);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function safeStem(name: string) {
  return (
    name
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 80) || 'scene'
  );
}
export function standaloneHtml(title: string, scene: Scene, runtime: string) {
  const safeTitle = title.replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        char
      ]!,
  );
  const sceneJson = JSON.stringify(scene).replace(/</g, '\\u003c');
  const safeRuntime = runtime.replace(/<\/script/gi, '<\\/script');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safeTitle} · SceneCraft</title>
<style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#080b20;color:#edf2f7;font:14px system-ui,sans-serif}body{display:grid;grid-template-rows:auto 1fr}.bar{display:flex;align-items:center;gap:10px;padding:10px 14px;background:#111827;border-bottom:1px solid #293244}.bar strong{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.bar button{border:1px solid #39465d;border-radius:7px;background:#202b3c;color:inherit;padding:7px 12px;cursor:pointer}.view{position:relative;min-height:0}.canvas{width:100%;height:100%}.hint{position:absolute;right:12px;bottom:12px;padding:7px 10px;border-radius:6px;background:#101827cc;color:#cbd5e1;pointer-events:none}</style></head>
<body><header class="bar"><strong>${safeTitle}</strong><button id="play">Pause</button><button id="reset">Reset</button><label>Time <input id="time" type="range" min="0" max="${scene.settings.durationSeconds}" step="0.01" value="0"></label></header><main class="view"><div class="canvas" id="scene"></div><span class="hint">Drag to orbit · scroll to zoom</span></main>
<script>${safeRuntime}</script><script>const spec=${sceneJson};const runtime=SceneCraftStandalone.mount(spec,document.getElementById('scene'));const play=document.getElementById('play');const slider=document.getElementById('time');play.onclick=()=>{if(runtime.clock.playing){runtime.pause();play.textContent='Play'}else{runtime.play();play.textContent='Pause'}};document.getElementById('reset').onclick=()=>{runtime.reset();play.textContent='Play';slider.value='0'};slider.oninput=()=>runtime.seek(Number(slider.value));setInterval(()=>{if(runtime.clock.playing&&document.activeElement!==slider)slider.value=String(runtime.clock.time)},50);</script></body></html>`;
}
export function exportJson(project: Project) {
  const scene = sceneSchema.parse(project.scene);
  download(
    new Blob([JSON.stringify(scene, null, 2)], { type: 'application/json' }),
    `${safeStem(project.title)}.scene.json`,
  );
}
export async function exportStandalone(project: Project) {
  const scene = sceneSchema.parse(project.scene);
  if (scene.objects.some((object) => object.type === 'asset'))
    throw new Error(
      'Standalone HTML currently supports procedural scenes. Export a Project ZIP to include imported models.',
    );
  const response = await fetch('/standalone-runtime.js');
  if (!response.ok)
    throw new Error(
      'Standalone renderer bundle is unavailable. Rebuild the application and try again.',
    );
  const runtime = await response.text();
  if (!runtime.trim()) throw new Error('Standalone renderer bundle is empty.');
  const html = standaloneHtml(project.title, scene, runtime);
  download(
    new Blob([html], { type: 'text/html;charset=utf-8' }),
    `${safeStem(project.title)}.html`,
  );
}
export async function exportArchive(project: Project) {
  const scene = sceneSchema.parse(project.scene);
  const files: Record<string, Uint8Array> = {
    'scene.json': strToU8(JSON.stringify(scene, null, 2)),
    'project.json': strToU8(
      JSON.stringify(
        {
          id: project.id,
          title: project.title,
          revision: project.revision,
          createdAt: project.createdAt,
          updatedAt: project.updatedAt,
          schemaVersion: scene.schemaVersion,
        },
        null,
        2,
      ),
    ),
    'README.txt': strToU8(
      `SceneCraft local project archive\n\nOpen scene.json in SceneCraft AI or import it from Projects. Local asset files are included under assets/.\nNo provider keys, server configuration, or session data are included.\n`,
    ),
    'ATTRIBUTION.txt': strToU8(
      'Scene contains only user-authored procedural geometry and bundled runtime dependencies.\n',
    ),
  };
  const assets = await listAssets();
  const referenced = new Set(
    scene.objects
      .map((o) => o.properties.assetId)
      .filter((x): x is string => Boolean(x)),
  );
  const available = new Map(assets.map((asset) => [asset.id, asset]));
  const missing = [...referenced].filter((id) => !available.has(id));
  if (missing.length)
    throw new Error(
      `Project archive is missing ${missing.length} referenced local asset${missing.length === 1 ? '' : 's'}. Restore or remove the missing model before exporting.`,
    );
  for (const a of assets) {
    if (!referenced.has(a.id)) continue;
    const bytes = new Uint8Array(await a.blob.arrayBuffer());
    files[`assets/${a.id}/${a.name.replace(/[\\/]/g, '_')}`] = bytes;
  }
  const output = zipSync(files, { level: 6 });
  download(
    new Blob([output], { type: 'application/zip' }),
    `${safeStem(project.title)}.scenecraft.zip`,
  );
}
