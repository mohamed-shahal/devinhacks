import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../.local',
);
const keyPath = resolve(root, 'credential-key');
let keyPromise: Promise<Buffer> | undefined;
async function key() {
  return (keyPromise ??= (async () => {
    await mkdir(root, { recursive: true, mode: 0o700 });
    try {
      const k = await readFile(keyPath);
      if (k.length !== 32) throw new Error('Local credential key is invalid.');
      await chmod(keyPath, 0o600);
      return k;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
      const k = randomBytes(32);
      await writeFile(keyPath, k, { mode: 0o600, flag: 'wx' });
      return k;
    }
  })());
}
export async function encryptSecret(secret: string) {
  const k = await key();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', k, iv);
  const encrypted = Buffer.concat([
    cipher.update(secret, 'utf8'),
    cipher.final(),
  ]);
  return `v1.${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${encrypted.toString('base64url')}`;
}
export async function decryptSecret(value: string) {
  const [version, iv, tag, body] = value.split('.');
  if (version !== 'v1' || !iv || !tag || !body)
    throw new Error('Credential could not be decrypted.');
  const decipher = createDecipheriv(
    'aes-256-gcm',
    await key(),
    Buffer.from(iv, 'base64url'),
  );
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(body, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}
export function validateCredential(value: string) {
  return value.length >= 20 && value.length <= 4096 && !/[\r\n]/.test(value);
}
