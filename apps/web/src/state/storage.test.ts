import { describe, expect, it } from 'vitest';
import { preset } from '@scenecraft/scene-schema';
import { restoreRevision } from './storage';

describe('saved project revisions', () => {
  it('restores an older snapshot as a new revision while retaining history', () => {
    const oldScene = preset('Neon robot');
    const currentScene = preset('Glowing forest');
    const project = {
      id: 'project_test',
      title: 'Revision test',
      scene: currentScene,
      createdAt: 1,
      updatedAt: 2,
      revision: 8,
      history: [
        {
          number: 3,
          scene: oldScene,
          source: 'template' as const,
          summary: 'Neon version',
          createdAt: 1,
        },
        {
          number: 8,
          scene: currentScene,
          source: 'manual' as const,
          summary: 'Forest version',
          createdAt: 2,
        },
      ],
    };
    const restored = restoreRevision(project, 0);
    expect(restored.scene).toEqual(oldScene);
    expect(restored.revision).toBe(9);
    expect(restored.history).toHaveLength(3);
    expect(restored.history[2]?.summary).toContain('Restored saved revision 3');
    expect(project.scene).toEqual(currentScene);
  });
});
