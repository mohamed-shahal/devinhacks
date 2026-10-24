import { healthSchema } from '@scenecraft/shared';

export async function getHealth(signal?: AbortSignal) {
  const response = await fetch('/api/v1/health', {
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(5_000)])
      : AbortSignal.timeout(5_000),
    credentials: 'omit',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error('The local API could not be reached.');
  const result = healthSchema.safeParse(await response.json());
  if (!result.success)
    throw new Error('The API returned an unexpected health response.');
  return result.data;
}
