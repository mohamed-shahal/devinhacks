import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Download,
  FileCode2,
  FilePlus2,
  Film,
  Pause,
  Play,
  Plus,
  Redo2,
  Save,
  Send,
  Undo2,
  X,
} from 'lucide-react';
import {
  applyPatch,
  demoRefine,
  demoGenerate,
  makeObject,
  preset,
  presetNames,
} from '@scenecraft/scene-schema';
import type { SceneObject } from '@scenecraft/scene-schema';
import {
  useEditor,
  findSelected,
  getActiveProjectId,
} from '../../state/editor';
import {
  listProjects,
  getProject,
  getAssetBlob,
  listAssets,
} from '../../state/storage';
import { Viewport } from './Viewport';
import { generate, refine, getAssignments, getModels } from '../../api/studio';
import type { ModelRow } from '../../api/studio';
import {
  exportArchive,
  exportJson,
  exportStandalone,
} from '../../services/export';
const objectTypes: SceneObject['type'][] = [
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
  'group',
];
export function Editor() {
  const scene = useEditor((s) => s.scene),
    projectTitle = useEditor((s) => s.projectTitle),
    selectedId = useEditor((s) => s.selectedId),
    selected = findSelected(scene, selectedId),
    time = useEditor((s) => s.time),
    playing = useEditor((s) => s.playing),
    speed = useEditor((s) => s.speed),
    quality = useEditor((s) => s.quality),
    saveState = useEditor((s) => s.saveState),
    revision = useEditor((s) => s.revision);
  const edit = useEditor((s) => s.edit),
    select = useEditor((s) => s.select),
    undo = useEditor((s) => s.undo),
    redo = useEditor((s) => s.redo),
    save = useEditor((s) => s.save),
    setScene = useEditor((s) => s.setScene),
    setTitle = useEditor((s) => s.setTitle),
    setSpeed = useEditor((s) => s.setSpeed),
    setQuality = useEditor((s) => s.setQuality),
    setTick = useEditor((s) => s.tick),
    [prompt, setPrompt] = useState(''),
    [refineText, setRefineText] = useState(''),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(''),
    [pendingPatch, setPendingPatch] = useState<Awaited<
      ReturnType<typeof refine>
    > | null>(null),
    [presetChoice, setPresetChoice] = useState<string>('Neon robot'),
    [savedProjects, setSavedProjects] = useState<
      Array<{ id: string; title: string; updatedAt: number }>
    >([]),
    [panel, setPanel] = useState<'hierarchy' | 'chat'>('hierarchy'),
    [tracks, setTracks] = useState(true),
    [listError, setListError] = useState('');
  const timer = useRef<number | undefined>(undefined);
  const [modelCatalog, setModelCatalog] = useState<ModelRow[]>([]);
  const [localModels, setLocalModels] = useState<
    Array<{ id: string; name: string; mime: string }>
  >([]);
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [image, setImage] = useState<File | null>(null);
  const [exportMenu, setExportMenu] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    void listProjects()
      .then((rows) =>
        setSavedProjects(
          rows.map(({ id, title, updatedAt }) => ({ id, title, updatedAt })),
        ),
      )
      .catch(() => setListError('Local storage is not available.'));
    void Promise.all([getModels(), getAssignments()])
      .then(([m, a]) => {
        setModelCatalog(m);
        setAssignments(a);
      })
      .catch(() => {});
  }, [saveState, scene]);
  useEffect(() => {
    void listAssets()
      .then((assets) =>
        setLocalModels(
          assets
            .filter((asset) => asset.mime.startsWith('model/'))
            .map(({ id, name, mime }) => ({ id, name, mime })),
        ),
      )
      .catch(() => setNotice('The local asset library could not be read.'));
  }, []);
  useEffect(() => {
    let alive = true;
    async function loadReference(id: string) {
      const asset = await getAssetBlob(id);
      if (alive && asset?.mime.startsWith('image/')) {
        setImage(new File([asset.blob], asset.name, { type: asset.mime }));
        setNotice(`${asset.name} attached as a reference image.`);
      }
    }
    const pendingId = sessionStorage.getItem('scenecraft:reference-image');
    if (pendingId) {
      sessionStorage.removeItem('scenecraft:reference-image');
      void loadReference(pendingId);
    }
    const onReference = (event: Event) => {
      const id = (event as CustomEvent<string>).detail;
      if (typeof id === 'string') void loadReference(id);
    };
    window.addEventListener('scenecraft:reference-selected', onReference);
    return () => {
      alive = false;
      window.removeEventListener('scenecraft:reference-selected', onReference);
    };
  }, []);
  useEffect(() => {
    let alive = true;
    const activeId = getActiveProjectId();
    if (!activeId) {
      queueMicrotask(() => {
        if (alive) setHydrated(true);
      });
      return () => {
        alive = false;
      };
    }
    void getProject(activeId)
      .then((project) => {
        if (!alive) return;
        if (project) useEditor.getState().load(project);
        setHydrated(true);
      })
      .catch(() => {
        if (alive) {
          setListError('The last local project could not be restored.');
          setHydrated(true);
        }
      });
    return () => {
      alive = false;
    };
  }, []);
  // Recover unsaved state in a clearly local browser project record.
  useEffect(() => {
    if (!hydrated) return;
    timer.current = window.setTimeout(
      () => void save().catch((e) => setNotice(e.message)),
      1200,
    );
    return () => window.clearTimeout(timer.current);
  }, [scene, revision, save, projectTitle, hydrated]);
  async function imageData(file: File) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const binary = Array.from(bytes, (x) => String.fromCharCode(x)).join('');
    return {
      mimeType: file.type as 'image/png' | 'image/jpeg' | 'image/webp',
      data: btoa(binary),
    };
  }
  async function generateScene(demo: boolean) {
    if (!prompt.trim()) return;
    setBusy(true);
    setNotice('');
    try {
      if (demo) {
        const s = demoGenerate(prompt);
        setScene(s, 'template', 'Local template result');
        setNotice(
          'Demo mode · Local template result. No model request was made.',
        );
      } else {
        const task = image ? 'reference_analysis' : 'scene_planning';
        const modelId = assignments[task];
        const eligible = modelCatalog.filter(
          (m) =>
            m.enabled &&
            m.capabilities.includes('text') &&
            m.capabilities.includes('structured_output') &&
            (!image || m.capabilities.includes('image_input')),
        );
        if (
          modelId &&
          modelId !== 'automatic' &&
          !eligible.some((m) => m.id === modelId)
        )
          throw new Error(
            'The assigned model does not support the required capabilities. Update its verified capability settings in AI Models.',
          );
        if ((!modelId || modelId === 'automatic') && !eligible.length)
          throw new Error(
            'No eligible configured model is available. Configure one in AI Models or use local demo mode.',
          );
        const selected =
          modelId && modelId !== 'automatic' ? modelId : undefined;
        const result = await generate(
          prompt,
          selected,
          image ? await imageData(image) : undefined,
        );
        setScene(result.scene, 'ai', `Generated with ${result.modelId}`);
        setNotice(
          `Validated scene from ${result.modelId} · ${result.latencyMs} ms`,
        );
      }
    } catch (e) {
      setNotice(
        e instanceof Error
          ? e.message
          : 'Scene generation failed. The current scene is unchanged.',
      );
    } finally {
      setBusy(false);
    }
  }
  async function askRefine(demo = false) {
    if (!refineText.trim()) return;
    setBusy(true);
    setNotice('');
    try {
      if (demo) {
        const patch = demoRefine(refineText, scene, revision, selectedId);
        applyPatch(scene, patch, revision);
        setPendingPatch({ patch, modelId: 'Local demo rules', latencyMs: 0 });
        setNotice(
          'Demo mode · Review the local deterministic change proposal.',
        );
        return;
      }
      const taskModel = assignments.scene_refinement;
      const eligible = modelCatalog.filter(
        (m) =>
          m.enabled &&
          m.capabilities.includes('text') &&
          m.capabilities.includes('structured_output'),
      );
      if (!eligible.length)
        throw new Error(
          'Configure a text and structured output model in AI Models, or refine in a later demo update.',
        );
      if (
        taskModel &&
        taskModel !== 'automatic' &&
        !eligible.some((m) => m.id === taskModel)
      )
        throw new Error('The assigned refinement model is not eligible.');
      const result = await refine(
        refineText,
        scene,
        revision,
        selectedId,
        taskModel === 'automatic' ? undefined : taskModel,
      );
      applyPatch(scene, result.patch, revision);
      setPendingPatch(result);
    } catch (e) {
      setNotice(
        e instanceof Error
          ? e.message
          : 'Refinement failed. The current scene is unchanged.',
      );
    } finally {
      setBusy(false);
    }
  }
  function acceptPatch() {
    if (!pendingPatch) return;
    try {
      const next = applyPatch(scene, pendingPatch.patch, revision);
      setScene(next, 'ai', pendingPatch.patch.explanation);
      setNotice(pendingPatch.patch.explanation);
      setPendingPatch(null);
      setRefineText('');
    } catch (e) {
      setNotice(
        e instanceof Error
          ? e.message
          : 'The proposed edit could not be applied.',
      );
    }
  }
  const sorted = useMemo(() => scene.objects, [scene.objects]);
  function setTransform(
    axis: 'position' | 'rotation' | 'scale',
    index: number,
    value: number,
  ) {
    if (!selected) return;
    edit((s) => {
      const o = s.objects.find((x) => x.id === selected.id)!;
      o.transform[axis][index] = value;
      return s;
    }, `Changed ${axis}`);
  }
  function removeObject() {
    if (!selected) return;
    edit((s) => {
      const gone = new Set([selected.id]);
      for (const o of s.objects)
        if (o.parentId && gone.has(o.parentId)) gone.add(o.id);
      s.objects = s.objects.filter((o) => !gone.has(o.id));
      return s;
    }, `Removed ${selected.name}`);
    select(null);
  }
  function duplicate() {
    if (!selected) return;
    const copy = structuredClone(selected);
    copy.id = `${selected.type}_${crypto.randomUUID()}`;
    copy.name = `${selected.name} copy`;
    copy.transform.position[0] += 0.7;
    edit((s) => {
      s.objects.push(copy);
      return s;
    }, `Duplicated ${selected.name}`);
    select(copy.id);
  }
  const duration = scene.settings.durationSeconds;
  return (
    <>
      <header className="studio-header">
        <div className="title-wrap">
          <input
            aria-label="Project name"
            maxLength={120}
            value={projectTitle}
            onChange={(e) => setTitle(e.target.value)}
          />
          <span className={`save-indicator ${saveState.toLowerCase()}`}>
            {saveState === 'Saved' ? <Check size={13} /> : <Save size={13} />}{' '}
            {saveState === 'Saved' ? 'Saved locally' : saveState}
          </span>
        </div>
        <div className="studio-actions">
          <button
            aria-label="Undo"
            title="Undo"
            disabled={!useEditor((s) => s.past.length)}
            onClick={undo}
          >
            <Undo2 size={16} />
          </button>
          <button
            aria-label="Redo"
            title="Redo"
            disabled={!useEditor((s) => s.future.length)}
            onClick={redo}
          >
            <Redo2 size={16} />
          </button>
          <select
            aria-label="Preview quality"
            value={quality}
            onChange={(e) => setQuality(e.target.value as typeof quality)}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
          <button
            onClick={() =>
              void save()
                .then(() => setNotice('Project saved in this browser.'))
                .catch((e) => setNotice(e.message))
            }
          >
            <Save size={15} /> Save
          </button>
          <div className="export-control">
            <button onClick={() => setExportMenu(!exportMenu)}>
              <Download size={15} /> Export
            </button>
            {exportMenu && (
              <div className="export-menu">
                <button
                  onClick={() => {
                    const s = useEditor.getState();
                    const p = {
                      id: s.projectId,
                      title: s.projectTitle,
                      scene: s.scene,
                      revision: s.revision,
                      createdAt: Date.now(),
                      updatedAt: Date.now(),
                      history: [],
                    };
                    exportJson(p);
                    setExportMenu(false);
                    setNotice('Validated scene JSON exported.');
                  }}
                >
                  Scene JSON
                </button>
                <button
                  onClick={() => {
                    const s = useEditor.getState();
                    const p = {
                      id: s.projectId,
                      title: s.projectTitle,
                      scene: s.scene,
                      revision: s.revision,
                      createdAt: Date.now(),
                      updatedAt: Date.now(),
                      history: [],
                    };
                    void exportArchive(p)
                      .then(() =>
                        setNotice(
                          'Project ZIP exported with local assets and no credentials.',
                        ),
                      )
                      .catch((e) => setNotice(e.message));
                    setExportMenu(false);
                  }}
                >
                  Project ZIP
                </button>
                <button
                  disabled={scene.objects.some(
                    (object) => object.type === 'asset',
                  )}
                  title={
                    scene.objects.some((object) => object.type === 'asset')
                      ? 'Standalone export currently supports procedural scenes. Export a Project ZIP to include imported models.'
                      : 'Download a self-contained HTML scene'
                  }
                  onClick={() => {
                    const s = useEditor.getState();
                    const p = {
                      id: s.projectId,
                      title: s.projectTitle,
                      scene: s.scene,
                      revision: s.revision,
                      createdAt: Date.now(),
                      updatedAt: Date.now(),
                      history: [],
                    };
                    void exportStandalone(p)
                      .then(() =>
                        setNotice(
                          'Standalone HTML exported. It includes the renderer and works without network access.',
                        ),
                      )
                      .catch((e) =>
                        setNotice(
                          e instanceof Error
                            ? e.message
                            : 'Standalone export failed.',
                        ),
                      );
                    setExportMenu(false);
                  }}
                >
                  <FileCode2 size={14} /> Standalone HTML
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
      <div className="editor-workspace">
        <aside className="editor-left">
          <div className="left-tabs">
            <button
              className={panel === 'hierarchy' ? 'selected' : ''}
              onClick={() => setPanel('hierarchy')}
            >
              Scene
            </button>
            <button
              className={panel === 'chat' ? 'selected' : ''}
              onClick={() => setPanel('chat')}
            >
              Refine
            </button>
          </div>
          {panel === 'hierarchy' ? (
            <>
              <div className="composer">
                <label htmlFor="scene-prompt">Describe a scene</label>
                <textarea
                  id="scene-prompt"
                  placeholder="A tiny robot dancing in a neon rainstorm…"
                  maxLength={6000}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                />
                <div className="composer-actions">
                  <button
                    className="button primary"
                    disabled={busy || prompt.trim().length < 8}
                    onClick={() => void generateScene(false)}
                  >
                    {busy ? (
                      'Working…'
                    ) : (
                      <>
                        <Send size={14} /> Generate
                      </>
                    )}
                  </button>
                  <button
                    className="button"
                    disabled={busy || prompt.trim().length < 8}
                    onClick={() => void generateScene(true)}
                  >
                    Try demo
                  </button>
                </div>
                <label className="image-attach">
                  Attach reference image
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (!f) {
                        setImage(null);
                        return;
                      }
                      if (
                        f.size > 10_000_000 ||
                        !['image/png', 'image/jpeg', 'image/webp'].includes(
                          f.type,
                        )
                      ) {
                        setNotice(
                          'Choose a PNG, JPEG or WebP image under 10 MB.',
                        );
                        e.currentTarget.value = '';
                        return;
                      }
                      setImage(f);
                    }}
                  />
                  {image && (
                    <span>
                      {image.name}{' '}
                      <button
                        type="button"
                        onClick={() => setImage(null)}
                        aria-label="Remove reference image"
                      >
                        ×
                      </button>
                    </span>
                  )}
                </label>
                <p className="microcopy">
                  Real generation sends this prompt
                  {image ? ' and reference image' : ''} to your assigned
                  provider. A single image guides composition; it does not
                  reconstruct a complete 3D model. Demo mode uses local
                  templates and does not send it.
                </p>
              </div>
              <div className="section-label">
                <span>Scene hierarchy</span>
                <div className="hierarchy-add-actions">
                  <button
                    aria-label="Add object"
                    title="Add object"
                    onClick={() => {
                      const type = objectTypes.find((t) => t !== 'group')!;
                      const o = makeObject(
                        type,
                        `${type.replaceAll('_', ' ')} ${scene.objects.length + 1}`,
                      );
                      edit((s) => {
                        s.objects.push(o);
                        return s;
                      }, 'Added object');
                      select(o.id);
                    }}
                  >
                    <Plus size={15} />
                  </button>
                  {localModels.length > 0 && (
                    <select
                      aria-label="Add imported model"
                      value=""
                      onChange={(event) => {
                        const asset = localModels.find(
                          (x) => x.id === event.target.value,
                        );
                        if (!asset) return;
                        const object = makeObject(
                          'asset',
                          asset.name.replace(/\.(glb|gltf)$/i, ''),
                        );
                        object.properties.assetId = asset.id;
                        edit((current) => {
                          current.objects.push(object);
                          return current;
                        }, 'Added imported model');
                        select(object.id);
                        event.currentTarget.value = '';
                      }}
                    >
                      <option value="">Add model…</option>
                      {localModels.map((asset) => (
                        <option value={asset.id} key={asset.id}>
                          {asset.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
              <div
                className="object-list"
                role="tree"
                aria-label="Scene hierarchy"
              >
                {sorted.map((o) => (
                  <div
                    className={`object-row ${selectedId === o.id ? 'active' : ''}`}
                    key={o.id}
                    role="treeitem"
                    aria-selected={selectedId === o.id}
                  >
                    <button
                      onClick={() => select(o.id)}
                      title={`Select ${o.name}`}
                    >
                      <span className="object-glyph">
                        {o.type === 'procedural_robot'
                          ? '◈'
                          : o.type === 'procedural_tree'
                            ? '♧'
                            : '◇'}
                      </span>
                      <span>{o.name}</span>
                      <small>{o.type.replaceAll('_', ' ')}</small>
                    </button>
                    <button
                      className="visibility-toggle"
                      aria-label={`${o.visible ? 'Hide' : 'Show'} ${o.name}`}
                      onClick={() =>
                        edit((s) => {
                          const x = s.objects.find((v) => v.id === o.id)!;
                          x.visible = !x.visible;
                          return s;
                        }, `Toggled ${o.name}`)
                      }
                    >
                      {o.visible ? '◉' : '○'}
                    </button>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="chat-panel">
              <p className="eyebrow">Validated change proposals</p>
              <p>
                Describe a targeted change. The current scene is checked before
                any edit is applied.
              </p>
              <textarea
                aria-label="Refinement instruction"
                placeholder="Make the robot taller and slow the dance…"
                maxLength={3000}
                value={refineText}
                onChange={(e) => setRefineText(e.target.value)}
              />
              <button
                className="button primary"
                disabled={busy || refineText.trim().length < 3}
                onClick={() => void askRefine(false)}
              >
                {busy ? 'Thinking…' : 'Propose change'}
              </button>
              <button
                className="button"
                disabled={busy || refineText.trim().length < 3}
                onClick={() => void askRefine(true)}
              >
                Try demo refinement
              </button>
              {pendingPatch && (
                <div className="patch-review">
                  <h3>Review change</h3>
                  <p>{pendingPatch.patch.explanation}</p>
                  {pendingPatch.patch.warnings.map((w) => (
                    <p className="warning" key={w}>
                      {w}
                    </p>
                  ))}
                  <div>
                    <button className="button primary" onClick={acceptPatch}>
                      Apply change
                    </button>
                    <button
                      className="button"
                      onClick={() => setPendingPatch(null)}
                    >
                      Discard
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          <div className="local-projects">
            <div className="section-label">
              <span>Recent projects</span>
              <button
                aria-label="New project"
                title="New project"
                onClick={() => {
                  const s = preset(
                    presetChoice as (typeof presetNames)[number],
                  );
                  useEditor.getState().newProject(s, s.metadata.title);
                  setScene(s, 'template', 'New local template');
                }}
              >
                {' '}
                <FilePlus2 size={14} />
              </button>
            </div>
            {savedProjects.slice(0, 4).map((p) => (
              <button
                className="project-link"
                key={p.id}
                onClick={() =>
                  void getProject(p.id).then(
                    (x) => x && useEditor.getState().load(x),
                  )
                }
              >
                {p.title}
              </button>
            ))}
            {listError && <p className="error-copy">{listError}</p>}
          </div>
        </aside>
        <div className="editor-center">
          <div className="center-top">
            <label htmlFor="preset">Scene template</label>
            <select
              id="preset"
              value={presetChoice}
              onChange={(e) => setPresetChoice(e.target.value)}
            >
              {presetNames.map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
            <button
              className="button"
              onClick={() => {
                const s = preset(presetChoice as (typeof presetNames)[number]);
                setScene(s, 'template', 'Loaded local preset');
                select(null);
              }}
            >
              Load template
            </button>
            <span className="demo-badge">LOCAL · EDITABLE</span>
          </div>
          <Viewport />
          <div className="timeline">
            <div className="timeline-top">
              <div>
                <strong>Animation</strong>
                <span>
                  {scene.objects.reduce((n, o) => n + o.animations.length, 0)}{' '}
                  tracks
                </span>
              </div>
              <button
                aria-label="Toggle animation tracks"
                onClick={() => setTracks(!tracks)}
              >
                {tracks ? 'Hide tracks' : 'Show tracks'}
              </button>
            </div>
            {tracks && (
              <>
                <div className="track-list">
                  {scene.objects.flatMap((o) =>
                    o.animations.map((a) => (
                      <div className="track-row" key={`${o.id}:${a.id}`}>
                        <span>{o.name}</span>
                        <small>{a.type.replaceAll('_', ' ')}</small>
                        <input
                          aria-label={`Enable ${a.type} on ${o.name}`}
                          type="checkbox"
                          checked={a.enabled}
                          onChange={(e) =>
                            edit((s) => {
                              const t = s.objects
                                .find((x) => x.id === o.id)!
                                .animations.find((x) => x.id === a.id)!;
                              t.enabled = e.target.checked;
                              return s;
                            }, 'Toggled animation')
                          }
                        />
                      </div>
                    )),
                  )}
                </div>
                <div className="scrubber">
                  <span>0:00</span>
                  <input
                    aria-label="Timeline position"
                    type="range"
                    min="0"
                    max={duration}
                    step="0.01"
                    value={time}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      useEditor.setState({ time: n, playing: false });
                    }}
                  />
                  <span>{duration.toFixed(1)}s</span>
                </div>
              </>
            )}
            <div className="transport">
              <button
                className="transport-main"
                aria-label={playing ? 'Pause animation' : 'Play animation'}
                onClick={() => setTick(time, !playing)}
              >
                {playing ? <Pause size={16} /> : <Play size={16} />}
              </button>
              <button
                aria-label="Reset animation"
                onClick={() => setTick(0, false)}
              >
                ↺
              </button>
              <span>
                {time.toFixed(2)} s <small>/ {duration.toFixed(1)} s</small>
              </span>
              <label htmlFor="playback-speed">Speed</label>
              <select
                id="playback-speed"
                value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
              >
                <option value="0.25">0.25×</option>
                <option value="0.5">0.5×</option>
                <option value="1">1×</option>
                <option value="1.5">1.5×</option>
                <option value="2">2×</option>
              </select>
            </div>
          </div>
        </div>
        <aside className="inspector">
          <div className="section-label inspector-heading">
            <span>Inspector</span>
            <small>
              {selected ? selected.type.replaceAll('_', ' ') : 'Scene'}
            </small>
          </div>
          {selected ? (
            <>
              <div className="inspector-body">
                <label>
                  Name
                  <input
                    maxLength={120}
                    value={selected.name}
                    onChange={(e) =>
                      edit((s) => {
                        s.objects.find((o) => o.id === selected.id)!.name =
                          e.target.value;
                        return s;
                      }, 'Renamed object')
                    }
                  />
                </label>
                <fieldset>
                  <legend>Position</legend>
                  {(['X', 'Y', 'Z'] as const).map((axis, i) => (
                    <label key={axis}>
                      {axis}
                      <input
                        aria-label={`Position ${axis}`}
                        type="number"
                        min="-10000"
                        max="10000"
                        step=".1"
                        value={selected.transform.position[i]}
                        onChange={(e) =>
                          setTransform('position', i, Number(e.target.value))
                        }
                      />
                    </label>
                  ))}
                </fieldset>
                <fieldset>
                  <legend>Rotation · degrees</legend>
                  {(['X', 'Y', 'Z'] as const).map((axis, i) => (
                    <label key={axis}>
                      {axis}
                      <input
                        aria-label={`Rotation ${axis}`}
                        type="number"
                        min="-36000"
                        max="36000"
                        step="1"
                        value={Math.round(
                          ((selected.transform.rotation[i] ?? 0) * 180) /
                            Math.PI,
                        )}
                        onChange={(e) =>
                          setTransform(
                            'rotation',
                            i,
                            (Number(e.target.value) * Math.PI) / 180,
                          )
                        }
                      />
                    </label>
                  ))}
                </fieldset>
                <fieldset>
                  <legend>Scale</legend>
                  {(['X', 'Y', 'Z'] as const).map((axis, i) => (
                    <label key={axis}>
                      {axis}
                      <input
                        aria-label={`Scale ${axis}`}
                        type="number"
                        min=".01"
                        max="100"
                        step=".1"
                        value={selected.transform.scale[i]}
                        onChange={(e) =>
                          setTransform('scale', i, Number(e.target.value))
                        }
                      />
                    </label>
                  ))}
                </fieldset>
                <label>
                  Material
                  <input
                    aria-label="Material color"
                    type="color"
                    value={selected.material.color}
                    onChange={(e) =>
                      edit((s) => {
                        s.objects.find(
                          (o) => o.id === selected.id,
                        )!.material.color = e.target.value;
                        return s;
                      }, 'Changed material')
                    }
                  />
                </label>
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={selected.visible}
                    onChange={(e) =>
                      edit((s) => {
                        s.objects.find((o) => o.id === selected.id)!.visible =
                          e.target.checked;
                        return s;
                      }, 'Changed visibility')
                    }
                  />{' '}
                  Visible
                </label>
                <div className="object-actions">
                  <button className="button" onClick={duplicate}>
                    Duplicate
                  </button>
                  <button className="button danger" onClick={removeObject}>
                    <X size={13} /> Delete
                  </button>
                </div>
                <button
                  className="button frame-button"
                  onClick={() =>
                    document
                      .querySelector<HTMLButtonElement>(
                        '[aria-label="Frame selected object"]',
                      )
                      ?.click()
                  }
                >
                  Frame in viewport
                </button>
              </div>
            </>
          ) : (
            <div className="inspector-empty">
              <Film size={24} />
              <h3>Select an object</h3>
              <p>Choose an item in the hierarchy or click it in the scene.</p>
              <button
                className="button"
                onClick={() => {
                  const o = makeObject('box', 'Box');
                  edit((s) => {
                    s.objects.push(o);
                    return s;
                  }, 'Added box');
                  select(o.id);
                }}
              >
                Add a box
              </button>
            </div>
          )}
        </aside>
      </div>
      {notice && (
        <div className="toast" role="status">
          {notice}
          <button aria-label="Dismiss message" onClick={() => setNotice('')}>
            ×
          </button>
        </div>
      )}
    </>
  );
}
