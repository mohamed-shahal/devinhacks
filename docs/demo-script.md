# Demo script

## Video-first Studio

1. Open **Video Studio**. Choose **A short story brief** or **A long script**. For a script, use scene headings or paragraphs; the film duration follows the script and actual speech.
2. Choose **Randomize angles** and reshuffle to explore distinct camera presets, or choose **Choose manually** to set each shot's angle and camera move. Reorder a cut or add a fourth shot.
3. Choose landscape/portrait/square and HD/Full HD. Enable **AI narration**, select Marin/Cedar/Coral and a voice model, or choose Silent. The 10/15-second setting applies to briefs; narration may extend it.
4. In **AI Models**, connect OpenAI, load the catalog, add GPT-6.1 Sol with text and structured-output capabilities, and assign it to Scene planning. This uses the recommended model without hardcoding it as the only supported choice.
5. Click **Prepare scenes & narration**. Progress updates while OpenAI designs each scene and records speech. Expand each prepared scene to review its narration and listen to the audio. If a stage fails, use **Retry unfinished scene**; completed stages are retained. A browser refresh reconnects while the API job cache exists.
6. Click **Render prepared film** and keep the tab open. Three.js renders every scene and camera cut, then FFmpeg combines the recording and narration. Preview and download the MP4. Encoding failure offers retry using the existing recording and an explicitly labeled picture-only WebM recovery download.

An OpenAI API key is required. The script and narration are sent to OpenAI; validated scene data is rendered locally through Three.js. Describe the output as stylized Three.js animation with optional AI narration. There is no music generation, sound-effect track, lip sync or voice cloning. Runway is not required. Limits are 12,000 script characters, twelve scenes and ten minutes. Jobs/audio expire after one hour or API restart; download the finished video for permanent storage.

## Legacy 3D scene editor

The scene editor remains at `/scene-editor` for maintaining existing work. The current source of truth is [implement.md](../implement.md).
