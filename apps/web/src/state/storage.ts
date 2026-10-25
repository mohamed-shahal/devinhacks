import { openDB } from 'idb';
import type { DBSchema, IDBPDatabase } from 'idb';
import type { Scene } from '@scenecraft/scene-schema';
interface Revision {
  number: number;
  scene: Scene;
  source: 'manual' | 'ai' | 'template' | 'migration';
  summary: string;
  createdAt: number;
}
export interface Project {
  id: string;
  title: string;
  scene: Scene;
  createdAt: number;
  updatedAt: number;
  revision: number;
  history: Revision[];
}
export interface Asset {
  id: string;
  name: string;
  mime: string;
  size: number;
  blob: Blob;
  createdAt: number;
}
interface StudioDB extends DBSchema {
  projects: { key: string; value: Project; indexes: { 'by-updated': number } };
  assets: { key: string; value: Asset };
}
let database: Promise<IDBPDatabase<StudioDB>> | null = null;
function db() {
  return (database ??= openDB<StudioDB>('scenecraft-local-v1', 1, {
    upgrade(d) {
      const p = d.createObjectStore('projects', { keyPath: 'id' });
      p.createIndex('by-updated', 'updatedAt');
      d.createObjectStore('assets', { keyPath: 'id' });
    },
  }));
}
export async function listProjects() {
  return (await db()).getAllFromIndex('projects', 'by-updated');
}
export async function saveProject(project: Project) {
  const d = await db();
  await d.put('projects', project);
  return project;
}
export async function getProject(id: string) {
  return (await db()).get('projects', id);
}
export async function deleteProject(id: string) {
  await (await db()).delete('projects', id);
}
export function restoreRevision(
  project: Project,
  revisionIndex: number,
): Project {
  const selected = project.history[revisionIndex];
  if (!selected) throw new Error('That saved revision is no longer available.');
  const number = project.revision + 1;
  const now = Date.now();
  return {
    ...project,
    scene: structuredClone(selected.scene),
    revision: number,
    updatedAt: now,
    history: [
      ...project.history,
      {
        number,
        scene: structuredClone(selected.scene),
        source: 'manual' as const,
        summary: `Restored saved revision ${selected.number || revisionIndex + 1}`,
        createdAt: now,
      },
    ].slice(-100),
  };
}
export async function listAssets() {
  return (await db()).getAll('assets');
}
export async function getAssetBlob(id: string) {
  return (await db()).get('assets', id);
}
export async function saveAsset(asset: Asset) {
  await (await db()).put('assets', asset);
}
export async function deleteAsset(id: string) {
  await (await db()).delete('assets', id);
}
export function projectId() {
  return `project_${crypto.randomUUID()}`;
}
export function assetId() {
  return `asset_${crypto.randomUUID()}`;
}
