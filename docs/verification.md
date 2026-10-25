# Verification record

Date: 2026-10-25. Runtime: Node 25.2.1 / npm 11.6.2 on macOS. CI targets Node 24 LTS; remote CI has not been run.

## Current script-film milestone

- `npm run check`: passed formatting, ESLint with zero warnings, strict TypeScript, **57 Vitest tests across 17 files**, standalone runtime, web production build and bundled Node API build. The existing large Three.js client chunk warning remains. Ineffective dynamic schema imports were removed.
- `npm run test:e2e`: **6 passed**, covering desktop and mobile Studio/model setup, preserved legacy editor flows, long script submission, AI voice settings, refresh recovery, unfinished-stage retry, narration previews and absence of horizontal overflow. Browser tests use mocked provider/job responses and make no paid requests.
- Timeout regression: fake-timer tests keep one background Response running for three minutes, recover a failed status retrieval without a second submission, and verify remote cancellation. The scene deadline is eight minutes; provider outages can still fail and expose retry.
- Checkpoint regression: narration failure reuses the already-generated scene, later-scene failure preserves completed scenes and original ordering, actual PCM duration extends the timeline, cancellation reaches the provider signal, and returned jobs omit credentials. Continuity context carries the subject's component geometry, proportions and colors.
- Script splitting tests preserve the complete original text/order and scene headings within the twelve-section bound. Oversized input is rejected. Maximum-length/ten-minute films have not been run against the paid provider.
- Audio adapter tests validate Realtime session configuration, server-only authentication, ordered PCM chunks, WAV headers/duration, cancellation and sanitized failures. An actual local FFmpeg/ffprobe integration test verifies H.264 + AAC output and retained duration.
- Live paid end-to-end smoke test: the configured OpenAI `gpt-6.1-sol` connection generated two scenes from a 479-character screenplay. `gpt-realtime-2.1-mini` generated Marin narration for both. The browser rendered six directed camera cuts through Three.js; FFmpeg produced an MP4 with narration. No template scene was substituted.
- Final sample inspected with ffprobe: **1280×720 H.264, 24 kHz mono AAC, 15.872 seconds, 2,067,359 bytes**. FFmpeg volume analysis confirmed non-silent audio (peak −7.4 dB). Contact-sheet review confirmed distinct forest/bridge scenes and wide/hero/close framing. The earlier high-DPI size doubling was corrected with a fixed capture pixel ratio. Full HD and portrait/square dimensions are implemented but were not separately smoke-tested against a live generated film.
- Ignored local evidence: `.local/verification/script-film-with-narration.mp4`, `studio-narrated-film.png` and `film-contact-sheet.jpg`. The Studio preview and download were verified without browser console warnings/errors during the live render.
- `npm audit --audit-level=low`: zero vulnerabilities on dependency installation.

## Operation and limits

The local app uses `http://127.0.0.1:5273/` and API port 8877. Automated browsers use dedicated ports 5274/8878 with server reuse disabled. Database, encryption key and verification artifacts are ignored under `.local/`.

OpenAI access is required for primary Studio preparation; voice-model access and separate audio usage are required for narration. FFmpeg is required for narrated MP4 export. Preparation accepts up to 12,000 characters, twelve scenes and ten minutes. Narration uses one built-in voice; music, sound effects, lip sync and voice cloning are not implemented. Output is stylized procedural Three.js animation.

Jobs and voice data remain in bounded process memory: one active preparation, six jobs and one-hour expiry after the last preparation update. Browser refresh can reconnect while that cache exists. API restart clears it. Recordings and final object URLs are browser-memory only; download output before refreshing/discarding. Keep the render tab visible during capture. Encoding failure retains the picture recording for retry and offers a clearly labeled picture-only WebM recovery download.

Hosted operation remains disabled. Account authentication, per-user authorization, durable background jobs, production key rotation and hosting operations are not implemented. A real imported GLB/GLTF placement has not been browser-verified. Standalone HTML supports procedural scenes; imported model scenes use Project ZIP. Optional Runway paid video generation has not been live-tested.
