import { create } from 'zustand';
import { preset } from '@scenecraft/scene-schema';
import type { Scene, SceneObject } from '@scenecraft/scene-schema';
import { projectId, saveProject } from './storage';
import type { Project } from './storage';
type Snapshot = {
  scene: Scene;
  at: number;
  source: 'manual' | 'ai' | 'template';
  summary: string;
};
type Editor = {
  scene: Scene;
  projectId: string;
  projectTitle: string;
  revision: number;
  selectedId: string | null;
  playing: boolean;
  time: number;
  speed: number;
  quality: Scene['settings']['quality'];
  saveState: 'Saved' | 'Saving' | 'Unsaved';
  past: Snapshot[];
  future: Snapshot[];
  setScene: (scene: Scene, source: Snapshot['source'], summary: string) => void;
  edit: (fn: (scene: Scene) => Scene, summary: string) => void;
  undo: () => void;
  redo: () => void;
  select: (id: string | null) => void;
  tick: (time: number, playing: boolean) => void;
  setTitle: (title: string) => void;
  setSpeed: (speed: number) => void;
  setQuality: (q: Scene['settings']['quality']) => void;
  load: (project: Project) => void;
  save: () => Promise<void>;
  newProject: (scene: Scene, title?: string) => void;
};
function snapshot(state: Editor): Snapshot {
  return {
    scene: structuredClone(state.scene),
    at: Date.now(),
    source: 'manual',
    summary: 'Manual edit',
  };
}
const activeProjectKey = 'scenecraft:active-project';
export function getActiveProjectId() {
  try {
    return localStorage.getItem(activeProjectKey);
  } catch {
    return null;
  }
}
function rememberActiveProject(id: string) {
  try {
    localStorage.setItem(activeProjectKey, id);
  } catch {
    // Editing remains available when browser storage is disabled.
  }
}
function initialProjectId() {
  return getActiveProjectId() ?? projectId();
}
export const useEditor = create<Editor>((set, get) => ({
  scene: preset('Neon robot'),
  projectId: initialProjectId(),
  projectTitle: 'Untitled scene',
  revision: 1,
  selectedId: 'Robot',
  playing: false,
  time: 0,
  speed: 1,
  quality: 'medium',
  saveState: 'Unsaved',
  past: [],
  future: [],
  setScene: (scene, source, summary) =>
    set((s) => ({
      past: [...s.past, { ...snapshot(s), source, summary } as Snapshot].slice(
        -100,
      ),
      future: [],
      scene: structuredClone(scene),
      revision: s.revision + 1,
      saveState: 'Unsaved',
      time: 0,
      playing: false,
    })),
  edit: (fn, summary) =>
    set((s) => ({
      past: [
        ...s.past,
        { ...snapshot(s), source: 'manual' as const, summary },
      ].slice(-100),
      future: [],
      scene: fn(structuredClone(s.scene)),
      revision: s.revision + 1,
      saveState: 'Unsaved',
    })),
  undo: () =>
    set((s) => {
      if (!s.past.length) return s;
      const prev = s.past.at(-1)!;
      return {
        past: s.past.slice(0, -1),
        future: [{ ...snapshot(s), summary: 'Redo' }, ...s.future].slice(
          0,
          100,
        ),
        scene: prev.scene,
        revision: s.revision + 1,
        saveState: 'Unsaved',
      };
    }),
  redo: () =>
    set((s) => {
      if (!s.future.length) return s;
      const next = s.future[0]!;
      return {
        past: [...s.past, { ...snapshot(s), summary: 'Undo' }].slice(-100),
        future: s.future.slice(1),
        scene: next.scene,
        revision: s.revision + 1,
        saveState: 'Unsaved',
      };
    }),
  select: (id) => set({ selectedId: id }),
  tick: (time, playing) => set({ time, playing }),
  setTitle: (title) => set({ projectTitle: title, saveState: 'Unsaved' }),
  setSpeed: (speed) => set({ speed }),
  setQuality: (quality) => set({ quality }),
  load: (project) => (
    set({
      scene: project.scene,
      projectId: project.id,
      projectTitle: project.title,
      revision: project.revision,
      selectedId: null,
      past: [],
      future: [],
      saveState: 'Saved',
      time: 0,
      playing: false,
    }),
    rememberActiveProject(project.id)
  ),
  save: async () => {
    const s = get();
    set({ saveState: 'Saving' });
    const record: Project = {
      id: s.projectId,
      title: s.projectTitle.trim() || 'Untitled scene',
      scene: s.scene,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      revision: s.revision,
      history: [
        ...s.past.map((x) => ({
          number: 0,
          scene: x.scene,
          source: x.source,
          summary: x.summary,
          createdAt: x.at,
        })),
        {
          number: s.revision,
          scene: s.scene,
          source: 'manual' as const,
          summary: 'Saved scene',
          createdAt: Date.now(),
        },
      ].slice(-100),
    };
    try {
      await saveProject(record);
      rememberActiveProject(s.projectId);
      if (get().revision === s.revision) set({ saveState: 'Saved' });
    } catch {
      set({ saveState: 'Unsaved' });
      throw new Error(
        'Scene could not be saved locally. Your edits remain in memory.',
      );
    }
  },
  newProject: (scene, title = 'Untitled scene') => {
    const id = projectId();
    rememberActiveProject(id);
    set(() => ({
      scene,
      projectId: id,
      projectTitle: title,
      revision: 1,
      selectedId: null,
      past: [],
      future: [],
      saveState: 'Unsaved',
      time: 0,
      playing: false,
    }));
  },
}));
export function findSelected(
  scene: Scene,
  id: string | null,
): SceneObject | undefined {
  return scene.objects.find((o) => o.id === id);
}
