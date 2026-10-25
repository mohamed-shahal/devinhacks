export const roadmap = [
  {
    id: 'M0',
    name: 'Audit & foundation',
    scope: 'Workspace, navigation, configuration and checks',
    state: 'Complete',
  },
  {
    id: 'M1',
    name: 'Schema & renderer',
    scope: 'Validated scenes, Three.js, presets and playback',
    state: 'Implemented · verify',
  },
  {
    id: 'M2',
    name: 'Studio editor',
    scope: 'Hierarchy, inspector, timeline and undo / redo',
    state: 'Implemented · verify',
  },
  {
    id: 'M3',
    name: 'AI Models',
    scope: 'Secure connections, capabilities and task routing',
    state: 'Local-only MVP',
  },
  {
    id: 'M4',
    name: 'Prompt generation',
    scope: 'Real provider generation and labeled demo mode',
    state: 'Implemented · verify',
  },
  {
    id: 'M5',
    name: 'Refinement & history',
    scope: 'Validated patches and restorable revisions',
    state: 'Local demo + restore · verify',
  },
  {
    id: 'M6',
    name: 'Images & assets',
    scope: 'Validated reference images and local model imports',
    state: 'Local placement · verify',
  },
  {
    id: 'M7',
    name: 'Persistence & export',
    scope: 'Project library, JSON, archives and standalone HTML',
    state: 'Local export · verify',
  },
  {
    id: 'M8',
    name: 'Hardening & demo',
    scope: 'Security, accessibility and complete journey checks',
    state: 'Legacy editor checks',
  },
  {
    id: 'M9',
    name: 'Cinematic video studio',
    scope: 'Direct camera shots, render a real video and download MP4',
    state: 'In progress',
  },
] as const;
