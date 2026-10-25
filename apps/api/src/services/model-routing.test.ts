import { describe, expect, it } from 'vitest';
import { prioritizeModelsForTask } from './model-routing';

describe('scene-planning model routing', () => {
  const models = [
    { id: 'gpt-6-astra', label: 'Astra' },
    { id: 'gpt-6.1-sol', label: 'Sol' },
    { id: 'gpt-6-luna', label: 'Luna' },
  ];

  it('prefers GPT-6.1 Sol for automatic scene planning when eligible', () => {
    expect(prioritizeModelsForTask(models, 'scene_planning')[0]?.id).toBe(
      'gpt-6.1-sol',
    );
  });

  it('keeps other task routing in configured label order', () => {
    expect(
      prioritizeModelsForTask(models, 'scene_refinement').map((m) => m.id),
    ).toEqual(['gpt-6-astra', 'gpt-6-luna', 'gpt-6.1-sol']);
  });
});
