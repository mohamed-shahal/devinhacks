import { mkdir, writeFile } from 'node:fs/promises';
import { build } from 'esbuild';

const result = await build({
  entryPoints: ['packages/scene-runtime/src/standalone.ts'],
  bundle: true,
  write: false,
  platform: 'browser',
  format: 'iife',
  globalName: 'SceneCraftStandalone',
  target: ['es2022'],
  minify: true,
  legalComments: 'none',
});
const output = result.outputFiles[0]?.text;
if (!output) throw new Error('Standalone runtime bundle was not produced.');
await mkdir('apps/web/public', { recursive: true });
await writeFile('apps/web/public/standalone-runtime.js', output);
console.log(
  `Built standalone runtime (${(Buffer.byteLength(output) / 1024).toFixed(0)} KB).`,
);
