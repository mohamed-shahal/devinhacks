import {
  filmJobSchema,
  patchSchema,
  sceneSchema,
} from '@scenecraft/scene-schema';
import type { Scene, ScenePatch } from '@scenecraft/scene-schema';
async function request<T>(
  path: string,
  init: RequestInit = {},
  check: (v: unknown) => boolean,
) {
  const response = await fetch(path, {
    ...init,
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const e = (data as { error?: { message?: string; code?: string } })?.error;
    throw new Error(e?.message ?? 'The request could not be completed.');
  }
  if (!check(data))
    throw new Error('The server returned data that failed validation.');
  return data as T;
}
function isScene(x: unknown): x is Scene {
  return sceneSchema.safeParse(x).success;
}
function isScenes(
  x: unknown,
): x is { scene: Scene; provider: string; modelId: string; latencyMs: number } {
  return (
    typeof x === 'object' &&
    x !== null &&
    isScene((x as { scene?: unknown }).scene)
  );
}
function isPatchResponse(
  x: unknown,
): x is { patch: ScenePatch; modelId: string; latencyMs: number } {
  return (
    typeof x === 'object' &&
    x !== null &&
    patchSchema.safeParse((x as { patch?: unknown }).patch).success
  );
}
type GenerateResponse = {
  scene: Scene;
  provider: string;
  modelId: string;
  latencyMs: number;
};
type RefineResponse = {
  patch: ScenePatch;
  modelId: string;
  latencyMs: number;
};
export function generate(
  prompt: string,
  modelId?: string,
  referenceImage?: { mimeType: string; data: string },
  signal?: AbortSignal,
) {
  return request<GenerateResponse>(
    '/api/v1/scenes/generate',
    {
      method: 'POST',
      body: JSON.stringify({
        prompt,
        ...(modelId ? { modelId } : {}),
        ...(referenceImage ? { referenceImage } : {}),
      }),
      ...(signal ? { signal } : {}),
    },
    isScenes,
  );
}
export function refine(
  prompt: string,
  scene: Scene,
  revision: number,
  selectedObjectId: string | null,
  modelId?: string,
  signal?: AbortSignal,
) {
  return request<RefineResponse>(
    '/api/v1/scenes/refine',
    {
      method: 'POST',
      body: JSON.stringify({
        prompt,
        scene,
        revision,
        ...(selectedObjectId ? { selectedObjectId } : {}),
        ...(modelId ? { modelId } : {}),
      }),
      ...(signal ? { signal } : {}),
    },
    isPatchResponse,
  );
}
export type ModelRow = {
  id: string;
  connectionId: string;
  label: string;
  capabilities: string[];
  connectionLabel: string;
  provider: string;
  enabled: number;
};
export type Connection = {
  id: string;
  label: string;
  provider: string;
  enabled: boolean;
  hasCredential: boolean;
  updatedAt: number;
};
const isArray = <T>(x: unknown): x is T[] => Array.isArray(x);
export const getConnections = () =>
  request<Connection[]>(
    '/api/v1/provider-connections',
    {},
    isArray<Connection>,
  );
export const getModels = () =>
  request<ModelRow[]>('/api/v1/models', {}, isArray<ModelRow>);
export const getAssignments = () =>
  request<Record<string, string>>(
    '/api/v1/task-assignments',
    {},
    (x): x is Record<string, string> => typeof x === 'object' && x !== null,
  );
export const getCatalog = (connectionId: string) =>
  request<Array<{ id: string; label: string; owner: string }>>(
    `/api/v1/provider-connections/${encodeURIComponent(connectionId)}/models`,
    {},
    isArray<{ id: string; label: string; owner: string }>,
  );
export const addConnection = (
  label: string,
  apiKey: string,
  provider: 'openai' | 'runway' = 'openai',
) =>
  request<Connection>(
    '/api/v1/provider-connections',
    {
      method: 'POST',
      body: JSON.stringify({ label, provider, apiKey }),
    },
    (x) =>
      typeof x === 'object' &&
      x !== null &&
      typeof (x as Connection).id === 'string',
  );
export const updateConnection = (
  id: string,
  body: { label?: string; enabled?: boolean; apiKey?: string },
) =>
  request<Connection>(
    `/api/v1/provider-connections/${encodeURIComponent(id)}`,
    { method: 'PATCH', body: JSON.stringify(body) },
    (x) => typeof x === 'object' && x !== null,
  );
export const deleteConnection = (id: string) =>
  request<void>(
    `/api/v1/provider-connections/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
    (x) => x === null,
  );
export const testConnection = (id: string) =>
  request<{ ok: boolean; message: string; latencyMs: number }>(
    `/api/v1/provider-connections/${encodeURIComponent(id)}/test`,
    { method: 'POST' },
    (x) => typeof x === 'object' && x !== null,
  );
export const saveModel = (
  connectionId: string,
  body: { id: string; label: string; capabilities: string[] },
) =>
  request<ModelRow>(
    `/api/v1/provider-connections/${encodeURIComponent(connectionId)}/models`,
    { method: 'POST', body: JSON.stringify(body) },
    (x) => typeof x === 'object' && x !== null,
  );
export const deleteModel = (id: string) =>
  request<void>(
    `/api/v1/models/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
    (x) => x === null,
  );
export const assignTask = (task: string, modelId: string) =>
  request(
    `/api/v1/task-assignments/${task}`,
    { method: 'PUT', body: JSON.stringify({ modelId }) },
    (x) => typeof x === 'object' && x !== null,
  );
export type AssetBlob = {
  id: string;
  name: string;
  mime: string;
  size: number;
  blob: Blob;
  createdAt: number;
};

export type VideoConnection = Pick<Connection, 'id' | 'label' | 'provider'>;
export type VideoShot = { angle: string; movement: string; action: string };
export type VideoJob = {
  id: string;
  status: 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELED';
};
export const getVideoConnections = () =>
  request<VideoConnection[]>(
    '/api/v1/video-connections',
    {},
    isArray<VideoConnection>,
  );
export const createVideoJob = (input: {
  connectionId: string;
  story: string;
  duration: 10 | 15;
  ratio: '16:9' | '9:16' | '1:1';
  audio: boolean;
  shots: VideoShot[];
}) =>
  request<VideoJob>(
    '/api/v1/videos/generate',
    { method: 'POST', body: JSON.stringify(input) },
    (x) =>
      typeof x === 'object' &&
      x !== null &&
      typeof (x as VideoJob).id === 'string' &&
      ['PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELED'].includes(
        (x as VideoJob).status,
      ),
  );
export const getVideoJob = (id: string) =>
  request<VideoJob>(
    `/api/v1/videos/${encodeURIComponent(id)}`,
    {},
    (x) =>
      typeof x === 'object' &&
      x !== null &&
      typeof (x as VideoJob).id === 'string' &&
      ['PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELED'].includes(
        (x as VideoJob).status,
      ),
  );

export async function transcodeVideo(webm: Blob) {
  const response = await fetch('/api/v1/videos/transcode', {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      Accept: 'video/mp4, application/json',
      'Content-Type': 'video/webm',
    },
    body: webm,
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;
    throw new Error(
      body?.error?.message ?? 'The video could not be converted.',
    );
  }
  return response.blob();
}

export async function startFilm(
  input: import('@scenecraft/scene-schema').FilmInput,
) {
  return request<import('@scenecraft/scene-schema').FilmJob>(
    '/api/v1/films',
    { method: 'POST', body: JSON.stringify(input) },
    (value) => filmJobSchema.safeParse(value).success,
  );
}
export async function loadFilm(id: string) {
  return request<import('@scenecraft/scene-schema').FilmJob>(
    `/api/v1/films/${encodeURIComponent(id)}`,
    {},
    (value) => filmJobSchema.safeParse(value).success,
  );
}
export async function changeFilm(id: string, action: 'retry' | 'cancel') {
  return request<import('@scenecraft/scene-schema').FilmJob>(
    `/api/v1/films/${encodeURIComponent(id)}/${action}`,
    { method: 'POST' },
    (value) => filmJobSchema.safeParse(value).success,
  );
}
export const deleteFilm = (id: string) =>
  request<void>(
    `/api/v1/films/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
    (value) => value === null,
  );
export async function encodeFilm(id: string, webm: Blob, signal?: AbortSignal) {
  const response = await fetch(
    `/api/v1/films/${encodeURIComponent(id)}/encode`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'video/webm', Accept: 'video/mp4' },
      body: webm,
      ...(signal ? { signal } : {}),
    },
  );
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;
    throw new Error(
      body?.error?.message ??
        'Encoding failed. Retry encoding; the recording is kept.',
    );
  }
  return response.blob();
}
