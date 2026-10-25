import { useEffect, useMemo, useState } from 'react';
import { Copy, Grid2X2, List, Plus, Search, Trash2 } from 'lucide-react';
import { preset, presetNames, sceneSchema } from '@scenecraft/scene-schema';
import {
  deleteProject,
  listProjects,
  projectId,
  restoreRevision,
  saveProject,
} from '../../state/storage';
import type { Project } from '../../state/storage';
import { useEditor } from '../../state/editor';
export function Projects() {
  const [projects, setProjects] = useState<Project[]>([]),
    [query, setQuery] = useState(''),
    [sort, setSort] = useState('updated'),
    [layout, setLayout] = useState<'grid' | 'list'>('grid'),
    [message, setMessage] = useState('');
  const load = () =>
    void listProjects()
      .then(setProjects)
      .catch(() =>
        setMessage(
          'Browser storage is unavailable. Refresh or try another browser.',
        ),
      );
  useEffect(() => {
    load();
  }, []);
  const filtered = useMemo(
    () =>
      projects
        .filter((x) => x.title.toLowerCase().includes(query.toLowerCase()))
        .sort((a, b) =>
          sort === 'name'
            ? a.title.localeCompare(b.title)
            : b.updatedAt - a.updatedAt,
        ),
    [projects, query, sort],
  );
  async function create(scene = preset('Neon robot')) {
    const now = Date.now(),
      project: Project = {
        id: projectId(),
        title: scene.metadata.title,
        scene,
        createdAt: now,
        updatedAt: now,
        revision: 1,
        history: [
          {
            number: 1,
            scene,
            source: 'template',
            summary: 'Created from local template',
            createdAt: now,
          },
        ],
      };
    await saveProject(project);
    useEditor.getState().load(project);
    load();
    setMessage('New local project created.');
  }
  async function duplicate(p: Project) {
    const now = Date.now(),
      copy: Project = {
        ...structuredClone(p),
        id: projectId(),
        title: `${p.title} copy`,
        createdAt: now,
        updatedAt: now,
        revision: 1,
        history: [
          {
            number: 1,
            scene: structuredClone(p.scene),
            source: 'template',
            summary: 'Duplicated project',
            createdAt: now,
          },
        ],
      };
    await saveProject(copy);
    load();
    setMessage('Project duplicated.');
  }
  async function rename(p: Project) {
    const title = window.prompt('Project name', p.title)?.trim();
    if (!title) return;
    if (title.length > 120) {
      setMessage('Project names must be 120 characters or fewer.');
      return;
    }
    await saveProject({ ...p, title, updatedAt: Date.now() });
    load();
  }
  async function remove(p: Project) {
    if (
      !window.confirm(
        `Delete “${p.title}” from this browser? This cannot be undone.`,
      )
    )
      return;
    await deleteProject(p.id);
    load();
    setMessage('Project deleted.');
  }
  async function importJson(file?: File) {
    if (!file) return;
    if (file.size > 3_000_000) {
      setMessage('Scene JSON must be smaller than 3 MB.');
      return;
    }
    try {
      const raw = JSON.parse(await file.text());
      const scene = sceneSchema.parse(raw);
      await create(scene);
    } catch {
      setMessage('This file is not a valid SceneCraft scene.');
    }
  }
  return (
    <>
      <div className="page-intro">
        <div>
          <p className="eyebrow">A home for every scene</p>
          <h1>Projects</h1>
          <p>Save, revisit and organize your editable worlds on this device.</p>
        </div>
        <button className="button primary" onClick={() => void create()}>
          <Plus size={15} /> New project
        </button>
      </div>
      <section className="content-panel projects-panel">
        <div className="project-toolbar">
          <label className="search-box">
            <Search size={15} />
            <input
              aria-label="Search projects"
              placeholder="Find a project"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <select
            aria-label="Sort projects"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="updated">Recently updated</option>
            <option value="name">Name</option>
          </select>
          <button
            aria-label="Grid view"
            className={layout === 'grid' ? 'selected' : ''}
            onClick={() => setLayout('grid')}
          >
            <Grid2X2 size={16} />
          </button>
          <button
            aria-label="List view"
            className={layout === 'list' ? 'selected' : ''}
            onClick={() => setLayout('list')}
          >
            <List size={16} />
          </button>
          <label className="button import-json">
            Import JSON
            <input
              type="file"
              accept="application/json,.json"
              onChange={(e) => void importJson(e.target.files?.[0])}
            />
          </label>
        </div>
        {filtered.length ? (
          <div className={`project-grid ${layout}`}>
            {filtered.map((p) => (
              <article className="project-card" key={p.id}>
                <button
                  className="project-preview"
                  aria-label={`Open ${p.title}`}
                  onClick={() => useEditor.getState().load(p)}
                >
                  <span className="preview-cube">◇</span>
                  <span>
                    {p.scene.objects.length} objects ·{' '}
                    {p.scene.settings.durationSeconds}s
                  </span>
                </button>
                <div className="project-card-main">
                  <div>
                    <button
                      className="project-title"
                      onClick={() => useEditor.getState().load(p)}
                    >
                      {p.title}
                    </button>
                    <small>
                      Updated {new Date(p.updatedAt).toLocaleString()}
                    </small>
                  </div>
                  <details>
                    <summary aria-label={`Actions for ${p.title}`}>···</summary>
                    <div className="project-menu">
                      <button onClick={() => void duplicate(p)}>
                        <Copy size={13} /> Duplicate
                      </button>
                      <button onClick={() => void rename(p)}>Rename</button>
                      <button onClick={() => void remove(p)}>
                        <Trash2 size={13} /> Delete
                      </button>
                      {p.history.length > 1 && (
                        <label className="revision-restore">
                          Restore saved revision
                          <select
                            aria-label={`Restore revision of ${p.title}`}
                            value=""
                            onChange={(event) => {
                              const index = Number(event.target.value);
                              const selected = p.history[index];
                              if (!selected) return;
                              if (
                                !window.confirm(
                                  `Restore “${selected.summary}” as a new revision of ${p.title}?`,
                                )
                              ) {
                                event.currentTarget.value = '';
                                return;
                              }
                              try {
                                const restored = restoreRevision(p, index);
                                void saveProject(restored)
                                  .then(() => {
                                    useEditor.getState().load(restored);
                                    load();
                                    setMessage(
                                      'Saved revision restored as a new revision.',
                                    );
                                  })
                                  .catch((error) =>
                                    setMessage(
                                      error instanceof Error
                                        ? error.message
                                        : 'Revision could not be saved.',
                                    ),
                                  );
                              } catch (error) {
                                setMessage(
                                  error instanceof Error
                                    ? error.message
                                    : 'Revision could not be restored.',
                                );
                              }
                              event.currentTarget.value = '';
                            }}
                          >
                            <option value="">Choose revision…</option>
                            {p.history.map((revision, index) => (
                              <option
                                value={index}
                                key={`${index}-${revision.createdAt}`}
                              >
                                {revision.number
                                  ? `Revision ${revision.number}`
                                  : `Saved state ${index + 1}`}{' '}
                                · {revision.summary}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                    </div>
                  </details>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="projects-empty">
            <span className="empty-mark">◇</span>
            <h2>
              {query
                ? 'No matching projects'
                : 'Your first scene is one click away.'}
            </h2>
            <p>
              {query
                ? 'Try another search term.'
                : 'Start from a procedural template or import a validated scene file.'}
            </p>
            <button
              className="button primary"
              onClick={() => void create(preset(presetNames[0]))}
            >
              <Plus size={15} /> Create project
            </button>
          </div>
        )}
      </section>
      {message && (
        <div role="status" className="toast">
          {message}
          <button onClick={() => setMessage('')} aria-label="Dismiss">
            ×
          </button>
        </div>
      )}
    </>
  );
}
