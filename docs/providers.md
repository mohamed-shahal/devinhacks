# Providers

## OpenAI scene planning + Three.js video rendering (primary)

The Video Studio requires an enabled OpenAI model configured for `text` and `structured_output`. GPT-6.1 Sol (`gpt-6.1-sol`) is the recommended model and is preferred by Automatic scene-planning routing when configured. The user's story is sent to OpenAI through the local API Responses endpoint with strict JSON Schema output and `store: false`; the returned scene is validated before use. No local procedural fallback is used in the primary Studio. If no eligible model is configured, rendering is blocked with an actionable link to AI Models. Users can explicitly use deterministic templates in the separate scene editor/demo flow.

Three to five directed shots per scene control actual camera framing and movement. In Script mode the API splits the input into up to twelve sections (12,000 characters, ten-minute film maximum), generates a detailed scene for each and keeps continuity context. The model-facing compact scene contract expands into the strict local schema. Three.js renders scenes locally at 720p/1080p without the editor grid, using subject-aware framing and neutral material environment lighting. `MediaRecorder` captures the canvas and FFmpeg encodes the MP4.

Scene generation uses [background Responses](https://developers.openai.com/api/docs/guides/background) with `store: false`, bounded status retrieval, an eight-minute scene deadline and cancellation. The API immediately returns a local film job ID; it does not keep the browser generation request open. Transient status retrieval failures retry the same response ID. Background responses are temporarily retained by OpenAI for roughly ten minutes for polling even with `store: false`.

Narration uses [OpenAI Realtime over WebSockets](https://developers.openai.com/api/docs/guides/voice-websockets) on the local server, with configurable `gpt-realtime-2.1-mini` (default) or `gpt-realtime-2.1` and Marin/Cedar/Coral built-in voices. The same saved OpenAI credential authenticates the voice request; account access to the selected voice model is required and audio usage is billed separately by OpenAI. Audio chunks are 24 kHz mono PCM, assembled as WAV, measured and aligned at each scene boundary. FFmpeg embeds AAC narration in the H.264 MP4. The Studio discloses AI-generated voice, allows Silent mode and plays individual narration previews before rendering. Audio failures are visible; retry reuses the scene. No voice cloning, lip sync, music generation or sound-effect generation is implemented.

Preparation jobs and audio are process-memory only (one active worker, six jobs, one-hour expiry after the last preparation update). Refresh can reconnect via the job ID; API restart clears the cache. Delete/discard prepared scenes from the Studio and download completed files for permanent storage. If encoding fails, the recording is kept for retry; picture-only WebM can be downloaded explicitly, with no claim that it contains narration.

## Runway video (optional)

Configure a Runway API key in **AI Models**. The key is sent once to the loopback API, encrypted at rest, never returned from the connection read route, and sent to Runway only for provider operations. The primary Video Studio submits a custom multi-shot video recipe with three to five directed prompts, supported duration, aspect ratio and audio preference. Runway tasks are asynchronous; the API stores only the provider task reference and polls status on demand.

The video task's signed output URL is short-lived. The local API retrieves and proxies MP4 bytes for browser playback/download, and never returns the URL to the browser. Generated media is not permanently archived by this app; download the output when it is ready. Generation requires a funded Runway account and may consume provider credits. Automated tests mock the provider and make no paid calls.

The request pins the multi-shot recipe version and API header version. Update these values only after verifying Runway's current API contract. See the [official multi-shot recipe](https://docs.dev.runwayml.com/recipes/multi-shot-video/) and [API setup](https://docs.dev.runwayml.com/guides/setup/).

## OpenAI scene generation

Configure an API key in **AI Models**, refresh the model catalog, add GPT-6.1 Sol (recommended) with `text` and `structured_output` capabilities, then assign it to Scene planning. Scene requests use the Responses API with strict JSON Schema output and `store: false`. Before sending, the local API normalizes Zod's JSON Schema into the Structured Outputs subset (including converting fixed-length vector tuples into bounded arrays). The original Zod schema remains authoritative for validating every returned scene. Provider validation errors are returned as bounded messages with credential-like values redacted, so rejected requests include actionable details without exposing the key. The model supplies the structured scene; the local Three.js runtime renders the video.

| Provider                                | Status                            | Use                                                          |
| --------------------------------------- | --------------------------------- | ------------------------------------------------------------ |
| OpenAI                                  | Implemented for local development | Required structured scene generation and optional refinement |
| Three.js                                | Implemented locally               | Animate OpenAI scene, directed camera cuts, canvas capture   |
| Runway                                  | Optional local integration        | Separate custom multi-shot video generation path             |
| Anthropic, Gemini, compatible endpoints | Deferred                          | No direct adapters                                           |

Hosted use is blocked until authentication, authorization, server-managed encryption and production operations are implemented.
