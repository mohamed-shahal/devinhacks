import { ProviderError } from './openai';

const base = 'https://api.dev.runwayml.com/v1';
const headers = (key: string) => ({
  Authorization: `Bearer ${key}`,
  'X-Runway-Version': '2024-11-06',
  'Content-Type': 'application/json',
});

async function request(path: string, key: string, init: RequestInit = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(`${base}${path}`, {
      ...init,
      signal: controller.signal,
      headers: { ...headers(key), ...init.headers },
    });
    if (!response.ok) {
      if (response.status === 401 || response.status === 403)
        throw new ProviderError(
          'PROVIDER_AUTH_FAILED',
          'Runway rejected this credential. Check the API key and project access.',
        );
      if (response.status === 429)
        throw new ProviderError(
          'PROVIDER_RATE_LIMITED',
          'Runway rate limit reached. Wait a moment and try again.',
        );
      throw new ProviderError(
        'PROVIDER_ERROR',
        `Runway request failed with status ${response.status}.`,
      );
    }
    return response;
  } catch (error) {
    if (error instanceof ProviderError) throw error;
    if (controller.signal.aborted)
      throw new ProviderError('PROVIDER_TIMEOUT', 'Runway request timed out.');
    throw new ProviderError(
      'PROVIDER_ERROR',
      'Runway could not be reached. Check your network connection.',
    );
  } finally {
    clearTimeout(timer);
  }
}

export async function testRunway(key: string) {
  const started = Date.now();
  await request('/model_routers', key, { method: 'GET' });
  return {
    ok: true,
    message: 'Runway accepted the credential for this project.',
    latencyMs: Date.now() - started,
  };
}

export type MultiShotRequest = {
  prompt: string;
  shots: Array<{ prompt: string; duration: number }>;
  duration: 10 | 15;
  ratio: '1280:720' | '720:1280' | '960:960';
  audio: boolean;
};

export async function createRunwayMultiShot(
  key: string,
  input: MultiShotRequest,
) {
  const response = await request('/recipes/multi_shot_video', key, {
    method: 'POST',
    body: JSON.stringify({
      version: '2026-06',
      mode: 'custom',
      duration: input.duration,
      ratio: input.ratio,
      audio: input.audio,
      shots: input.shots,
    }),
  });
  const data = (await response.json()) as { id?: string };
  if (!data.id || !/^[a-f\d-]{20,64}$/i.test(data.id))
    throw new ProviderError(
      'PROVIDER_ERROR',
      'Runway returned an invalid video task response.',
    );
  return data.id;
}

export type RunwayTask = {
  status: 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELED';
  output?: string[];
};

export async function getRunwayTask(key: string, taskId: string) {
  const response = await request(`/tasks/${encodeURIComponent(taskId)}`, key, {
    method: 'GET',
  });
  const data = (await response.json()) as {
    status?: string;
    output?: string[];
  };
  const statuses = ['PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELED'];
  if (!statuses.includes(data.status ?? ''))
    throw new ProviderError(
      'PROVIDER_ERROR',
      'Runway returned an unrecognized task status.',
    );
  return { status: data.status as RunwayTask['status'], output: data.output };
}

export async function downloadRunwayVideo(key: string, taskId: string) {
  const task = await getRunwayTask(key, taskId);
  if (task.status !== 'SUCCEEDED' || !task.output?.[0])
    throw new ProviderError(
      'PROVIDER_ERROR',
      'The video is not ready to download yet.',
    );
  let url: URL;
  try {
    url = new URL(task.output[0]);
  } catch {
    throw new ProviderError(
      'PROVIDER_ERROR',
      'Runway returned an invalid video result.',
    );
  }
  // Runway output links are short-lived signed CloudFront URLs. Never return
  // them to the browser or follow arbitrary provider-supplied hosts.
  if (
    url.protocol !== 'https:' ||
    !url.hostname.endsWith('.cloudfront.net') ||
    url.port ||
    url.username ||
    url.password
  )
    throw new ProviderError(
      'PROVIDER_ERROR',
      'Runway returned an unsafe video result.',
    );
  const maxBytes = 150_000_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120_000);
  try {
    const response = await fetch(url, {
      redirect: 'error',
      signal: controller.signal,
    });
    if (!response.ok)
      throw new ProviderError(
        'PROVIDER_ERROR',
        'The generated video could not be retrieved.',
      );
    const length = Number(response.headers.get('content-length') ?? 0);
    if (length > maxBytes)
      throw new ProviderError(
        'PROVIDER_ERROR',
        'The generated video exceeds the local download limit.',
      );
    const reader = response.body?.getReader();
    if (!reader)
      throw new ProviderError(
        'PROVIDER_ERROR',
        'The generated video could not be read.',
      );
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      total += next.value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new ProviderError(
          'PROVIDER_ERROR',
          'The generated video exceeds the local download limit.',
        );
      }
      chunks.push(next.value);
    }
    if (!total)
      throw new ProviderError(
        'PROVIDER_ERROR',
        'The generated video is empty.',
      );
    return Buffer.concat(
      chunks.map((chunk) => Buffer.from(chunk)),
      total,
    );
  } catch (error) {
    if (error instanceof ProviderError) throw error;
    if (controller.signal.aborted)
      throw new ProviderError(
        'PROVIDER_TIMEOUT',
        'The generated video download timed out.',
      );
    throw new ProviderError(
      'PROVIDER_ERROR',
      'The generated video could not be retrieved.',
    );
  } finally {
    clearTimeout(timer);
  }
}
