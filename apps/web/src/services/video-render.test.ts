import { describe, expect, it } from 'vitest';
import { filmFrameAt } from './video-render';

describe('film camera timeline', () => {
  it('starts at the first shot even when the first frame predates the recording clock', () => {
    expect(filmFrameAt(-0.0018, [10], [3])).toMatchObject({
      segmentIndex: 0,
      shotIndex: 0,
      local: 0,
      shotProgress: 0,
    });
  });
  it('cuts to the next scene with its own local animation clock', () => {
    expect(filmFrameAt(10, [10, 20], [3, 4])).toMatchObject({
      segmentIndex: 1,
      shotIndex: 0,
      local: 0,
    });
    expect(filmFrameAt(25, [10, 20], [3, 4])).toMatchObject({
      segmentIndex: 1,
      shotIndex: 3,
      local: 15,
    });
    expect(filmFrameAt(32, [10, 20], [3, 4])).toMatchObject({
      segmentIndex: 1,
      shotIndex: 3,
      shotProgress: 1,
    });
  });
});
