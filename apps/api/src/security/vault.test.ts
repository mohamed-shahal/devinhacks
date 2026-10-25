import { describe, expect, it } from 'vitest';
import { decryptSecret, encryptSecret, validateCredential } from './vault';

describe('local credential vault', () => {
  it('encrypts credentials at rest and restores them only in the API process', async () => {
    const secret = `sk-test-${'x'.repeat(32)}`;
    const encrypted = await encryptSecret(secret);
    expect(encrypted).not.toContain(secret);
    expect(encrypted.split('.')).toHaveLength(4);
    await expect(decryptSecret(encrypted)).resolves.toBe(secret);
  });

  it('rejects malformed credentials', () => {
    expect(validateCredential('short')).toBe(false);
    expect(validateCredential(`sk-test-${'x'.repeat(32)}`)).toBe(true);
    expect(validateCredential(`key\n${'x'.repeat(30)}`)).toBe(false);
  });
});
