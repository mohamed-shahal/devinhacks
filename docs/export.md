# Export

## Primary video output

The Video Studio records the Three.js canvas using the browser's `MediaRecorder`, then combines the picture and optional AI narration into MP4 through a bounded local FFmpeg route. Camera cuts and moves come from the shot list. Rendering runs locally and needs WebGL plus WebM recording support. If encoding fails, the browser keeps the picture recording for retry and an explicitly labeled picture-only WebM download. The app does not currently keep a permanent video library.

An eligible OpenAI model creates the validated scene description; Three.js renders all output frames. The primary Video Studio requires OpenAI scene planning. Runway remains an optional separate provider path and may consume paid credits. The MP4 transcoder accepts only bounded WebM bytes and invokes FFmpeg with a fixed argument list; it does not accept file paths or FFmpeg options from the browser.

## Legacy scene formats

The separate `/scene-editor` route retains:

- **Scene JSON:** validated scene specification.
- **Project ZIP:** project metadata, scene JSON, README, attribution notes and referenced local assets; no browser credentials or API configuration.
- **Standalone HTML:** bundled Three.js runtime and playback controls for procedural scenes. Imported GLB/GLTF scenes use Project ZIP.

Legacy scene exports validate their scene and referenced assets before download. Third-party asset licensing remains the user's responsibility.

## Script-film MP4 with narration

The Studio prepares up to twelve validated scenes, previews their AI narration and then records the complete Three.js film. HD is 1280×720 landscape (720×1280 portrait, 720×720 square); Full HD is 1920×1080, 1080×1920 or 1080×1080. Scene durations grow to fit actual speech. Render capture takes approximately the film's duration and the tab must remain open. A bounded FFmpeg call combines the scene-aligned WAV audio with the canvas recording using H.264 video, AAC narration, yuv420p and faststart. Silent mode omits narration. Recordings are capped at 390 MB and encoded output at 500 MB, with a five-minute FFmpeg deadline. Ten-minute films may need a capable desktop and sufficient memory.

Encoding failure preserves the in-memory recording for retry without another model call. An explicitly labeled picture-only WebM download is available as recovery. Refresh loses the canvas recording/output but can reuse prepared scenes/audio while the API job cache exists; restarting the API clears that cache. Download the MP4 before discarding its preparation. Narration uses one built-in AI voice; music, sound effects, lip sync and voice cloning are not included.
