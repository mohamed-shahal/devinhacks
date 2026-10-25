import { RECOMMENDED_SCENE_MODEL_ID } from '@scenecraft/shared';

type RoutableModel = { id: string; label: string };

export function prioritizeModelsForTask<T extends RoutableModel>(
  models: T[],
  task: string,
) {
  return [...models].sort((a, b) => {
    if (task === 'scene_planning') {
      if (a.id === RECOMMENDED_SCENE_MODEL_ID) return -1;
      if (b.id === RECOMMENDED_SCENE_MODEL_ID) return 1;
    }
    return a.label.localeCompare(b.label);
  });
}
