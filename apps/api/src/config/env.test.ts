import { describe, expect, it } from 'vitest';
import { parseEnv } from './env';

describe('environment boundary', () => {
  it('starts locally without any credentials', () => {
    expect(parseEnv({})).toEqual({
      NODE_ENV: 'development',
      APP_BASE_URL: 'http://localhost:5173',
      API_BASE_URL: 'http://localhost:8787',
      LOG_LEVEL: 'info',
    });
  });
  it.each([
    'https://example.com',
    'http://localhost:5173/path',
    'http://secret:password@localhost:5173',
    'file:///tmp/test',
    'http://localhost:5173?token=secret',
  ])('rejects unsafe local origin %s', (APP_BASE_URL) => {
    expect(() => parseEnv({ APP_BASE_URL })).toThrow('APP_BASE_URL');
  });
  it('accepts explicit loopback configuration', () => {
    expect(
      parseEnv({ API_BASE_URL: 'http://127.0.0.1:9000' }).API_BASE_URL,
    ).toBe('http://127.0.0.1:9000');
  });
  it('never includes an invalid environment value in its error', () => {
    expect(() => parseEnv({ NODE_ENV: 'secret-value' })).toThrow(
      'Invalid environment configuration: NODE_ENV',
    );
  });
  it('does not pass secret or unrelated variables into application config', () => {
    const env = parseEnv({
      SESSION_SECRET: 'private-value',
      CREDENTIAL_ENCRYPTION_KEY: 'private-key',
      VITE_API_KEY: 'must-not-be-public',
    });
    expect(Object.keys(env).sort()).toEqual([
      'API_BASE_URL',
      'APP_BASE_URL',
      'LOG_LEVEL',
      'NODE_ENV',
    ]);
  });
});
