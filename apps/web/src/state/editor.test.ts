import { beforeEach, describe, expect, it } from 'vitest';
import { preset } from '@scenecraft/scene-schema';
import { useEditor } from './editor';

describe('editor history', () => {
  beforeEach(() => {
    useEditor.getState().newProject(preset('Neon robot'), 'History test');
  });

  it('undoes and redoes a validated scene change as one operation', () => {
    const initial = useEditor.getState().scene;
    useEditor
      .getState()
      .setScene(preset('Glowing forest'), 'template', 'Changed template');
    expect(useEditor.getState().scene.metadata.title).toBe('Glowing forest');
    useEditor.getState().undo();
    expect(useEditor.getState().scene).toEqual(initial);
    useEditor.getState().redo();
    expect(useEditor.getState().scene.metadata.title).toBe('Glowing forest');
  });

  it('records inspector edits in history and marks the project unsaved', () => {
    useEditor.getState().edit((scene) => {
      scene.objects[0]!.name = 'Renamed robot';
      return scene;
    }, 'Renamed object');
    expect(useEditor.getState().scene.objects[0]?.name).toBe('Renamed robot');
    expect(useEditor.getState().saveState).toBe('Unsaved');
    useEditor.getState().undo();
    expect(useEditor.getState().scene.objects[0]?.name).toBe('Robot');
  });
});
