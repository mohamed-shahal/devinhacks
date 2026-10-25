export type ProviderErrorCode =
  | 'PROVIDER_AUTH_FAILED'
  | 'PROVIDER_RATE_LIMITED'
  | 'PROVIDER_TIMEOUT'
  | 'PROVIDER_ERROR';
export class ProviderError extends Error {
  constructor(
    readonly code: ProviderErrorCode,
    message: string,
  ) {
    super(message);
  }
}
export const base = 'https://api.openai.com/v1';
export function providerErrorMessage(body: unknown, key: string) {
  const error =
    body && typeof body === 'object' && 'error' in body
      ? (body as { error?: unknown }).error
      : undefined;
  const message =
    error && typeof error === 'object' && 'message' in error
      ? (error as { message?: unknown }).message
      : undefined;
  if (typeof message !== 'string' || !message.trim()) return undefined;

  // Provider errors are useful for fixing configuration and schema problems,
  // but must never reflect credentials or unbounded/control-character content.
  const printableMessage = Array.from(message, (character) => {
    const code = character.charCodeAt(0);
    return code <= 0x1f || code === 0x7f ? ' ' : character;
  }).join('');
  return printableMessage
    .replace(/\bBearer\s+\S+/gi, 'Bearer [redacted]')
    .replace(/sk-[A-Za-z0-9_-]{8,}/g, '[redacted]')
    .replaceAll(key, '[redacted]')
    .replace(/data:[^\s,]+;base64,[A-Za-z0-9+/=]+/g, '[image data redacted]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500);
}
async function request(
  path: string,
  key: string,
  init: RequestInit = {},
  timeout = 15000,
  signal?: AbortSignal,
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(`${base}${path}`, {
      ...init,
      signal: signal
        ? AbortSignal.any([signal, controller.signal])
        : controller.signal,
      headers: { Authorization: `Bearer ${key}`, ...init.headers },
    });
    if (!response.ok) {
      const detail = await response
        .clone()
        .json()
        .catch(() => undefined);
      const providerMessage = providerErrorMessage(detail, key);
      if (response.status === 401 || response.status === 403)
        throw new ProviderError(
          'PROVIDER_AUTH_FAILED',
          providerMessage ??
            'The provider rejected this credential. Check the key and account access.',
        );
      if (response.status === 429)
        throw new ProviderError(
          'PROVIDER_RATE_LIMITED',
          providerMessage ??
            'The provider rate limit was reached. Wait and try again.',
        );
      throw new ProviderError(
        'PROVIDER_ERROR',
        providerMessage ??
          `Provider request failed with status ${response.status}.`,
      );
    }
    return response;
  } catch (e) {
    if (signal?.aborted)
      throw new DOMException('Generation canceled.', 'AbortError');
    if (e instanceof ProviderError) throw e;
    if (controller.signal.aborted)
      throw new ProviderError(
        'PROVIDER_TIMEOUT',
        'The provider request timed out.',
      );
    throw new ProviderError(
      'PROVIDER_ERROR',
      'The provider could not be reached. Check your network connection.',
    );
  } finally {
    clearTimeout(timer);
  }
}
export async function testOpenAI(key: string) {
  const started = Date.now();
  await request('/models', key, {}, 10000);
  return {
    ok: true,
    message:
      'Credential accepted by OpenAI. Model capabilities still depend on your catalog settings.',
    latencyMs: Date.now() - started,
  };
}
export async function listOpenAIModels(key: string) {
  const r = await request('/models', key, {}, 10000);
  const data = (await r.json()) as {
    data?: Array<{ id?: string; owned_by?: string }>;
  };
  return (data.data ?? [])
    .filter((x) => x.id)
    .map((x) => ({
      id: x.id!,
      label: x.id!,
      provider: 'openai',
      owner: x.owned_by ?? 'unknown',
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}
export async function generateOpenAI(
  key: string,
  model: string,
  system: string,
  prompt: string,
  format: unknown,
  image?: { mimeType: string; data: string },
  options: { signal?: AbortSignal; onWaiting?: (seconds: number) => void } = {},
) {
  const started = Date.now();
  const userContent: Array<Record<string, string>> = [
    { type: 'input_text', text: prompt },
  ];
  if (image)
    userContent.push({
      type: 'input_image',
      image_url: `data:${image.mimeType};base64,${image.data}`,
      detail: 'auto',
    });
  const r = await request(
    '/responses',
    key,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        store: false,
        background: true,
        input: [
          { role: 'system', content: [{ type: 'input_text', text: system }] },
          { role: 'user', content: userContent },
        ],
        text: { format },
      }),
    },
    30_000,
    options.signal,
  );
  let data = (await r.json()) as {
    status?: string;
    error?: { message?: string };
    id?: string;
    output_text?: string;
    output?: Array<{
      type?: string;
      content?: Array<{ type?: string; text?: string }>;
    }>;
    usage?: { input_tokens?: number; output_tokens?: number };
  };
  const responseId = data.id;
  try {
    let transientFailures = 0;
    while (data.status === 'queued' || data.status === 'in_progress') {
      options.signal?.throwIfAborted();
      if (!responseId || !/^resp_[a-zA-Z0-9_-]+$/.test(responseId))
        throw new ProviderError(
          'PROVIDER_ERROR',
          'OpenAI returned an invalid response identifier.',
        );
      if (Date.now() - started > 8 * 60_000)
        throw new ProviderError(
          'PROVIDER_TIMEOUT',
          'OpenAI is taking longer than eight minutes for this scene. Retry this step or choose a faster scene-planning model.',
        );
      options.onWaiting?.(Math.round((Date.now() - started) / 1000));
      await new Promise<void>((resolve, reject) => {
        const abort = () => {
          clearTimeout(timer);
          reject(new DOMException('Generation canceled.', 'AbortError'));
        };
        const timer = setTimeout(() => {
          options.signal?.removeEventListener('abort', abort);
          resolve();
        }, 2500);
        options.signal?.addEventListener('abort', abort, { once: true });
        if (options.signal?.aborted) abort();
      });
      try {
        const status = await request(
          `/responses/${responseId}`,
          key,
          {},
          30_000,
          options.signal,
        );
        data = (await status.json()) as typeof data;
        transientFailures = 0;
      } catch (error) {
        if (
          options.signal?.aborted ||
          !(error instanceof ProviderError) ||
          error.code === 'PROVIDER_AUTH_FAILED' ||
          ++transientFailures > 3
        )
          throw error;
        // Retry retrieval of this response only, never create duplicate paid jobs.
      }
    }
    if (data.status && data.status !== 'completed')
      throw new ProviderError(
        'PROVIDER_ERROR',
        data.status === 'incomplete'
          ? 'OpenAI could not finish this scene within its output budget. Reduce scene complexity and retry.'
          : 'OpenAI did not complete the scene. Retry this step; completed scenes are kept.',
      );
  } catch (error) {
    if (responseId && /^resp_[a-zA-Z0-9_-]+$/.test(responseId))
      await request(
        `/responses/${responseId}/cancel`,
        key,
        { method: 'POST' },
        10_000,
      ).catch(() => undefined);
    throw error;
  }
  const text =
    data.output_text ??
    data.output
      ?.flatMap((x) => x.content ?? [])
      .find((x) => x.type === 'output_text')?.text;
  if (!text)
    throw new ProviderError(
      'PROVIDER_ERROR',
      'The provider returned no scene text.',
    );
  return {
    text,
    latencyMs: Date.now() - started,
    providerRequestId: data.id,
    usage: data.usage,
  };
}
