import { describe, expect, it } from 'vitest';
import { preset } from '@scenecraft/scene-schema';
import { standaloneHtml } from './export';

describe('standalone HTML export', () => {
  it('embeds a validated scene and local runtime without remote dependencies', () => {
    const html = standaloneHtml(
      'A <scene>',
      preset('Neon robot'),
      'window.localRuntime=1;',
    );
    expect(html).toContain('A &lt;scene&gt;');
    expect(html).toContain('window.localRuntime=1;');
    expect(html).toContain('SceneCraftStandalone.mount');
    expect(html).toContain('Drag to orbit');
    expect(html).not.toMatch(/https?:\/\//);
  });
});
