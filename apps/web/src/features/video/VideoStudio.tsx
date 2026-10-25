import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowDown,
  ArrowUp,
  Camera,
  Clapperboard,
  Download,
  Film,
  Plus,
  Shuffle,
  Sparkles,
  Trash2,
  Video,
} from 'lucide-react';
import {
  startFilm,
  loadFilm,
  changeFilm,
  deleteFilm,
  encodeFilm,
  getAssignments,
  getModels,
} from '../../api/studio';
import type { ModelRow, VideoShot } from '../../api/studio';
import { filmLimits } from '@scenecraft/scene-schema';
import type { FilmJob, FilmInput } from '@scenecraft/scene-schema';
import { RECOMMENDED_SCENE_MODEL_ID } from '@scenecraft/shared';
import { renderFilmVideo } from '../../services/video-render';

const initialShots: VideoShot[] = [
  {
    angle: 'Wide establishing',
    movement: 'Slow crane down',
    action: 'Reveal the setting and establish a strong sense of scale.',
  },
  {
    angle: 'Low-angle hero',
    movement: 'Slow dolly in',
    action: 'Bring the main subject into focus as it begins to move.',
  },
  {
    angle: 'Tight cinematic close-up',
    movement: 'Orbit left to right',
    action: 'Catch a vivid detail, expression, or moment of action.',
  },
];
const angleOptions = [
  'Wide establishing',
  'Low-angle hero',
  'Overhead top-down',
  'Profile tracking',
  'Tight cinematic close-up',
  'Dutch angle',
];
const movementOptions = [
  'Slow dolly in',
  'Pull back reveal',
  'Orbit left to right',
  'Tracking follow',
  'Crane down',
  'Locked-off composition',
];
type ShotMode = 'random' | 'manual';
function shuffled<T>(values: T[]) {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}
function randomizeShotChoices(current: VideoShot[]) {
  const angles = shuffled(angleOptions).slice(0, current.length);
  const movements = shuffled(movementOptions).slice(0, current.length);
  return current.map((shot, index) => ({
    ...shot,
    angle: angles[index]!,
    movement: movements[index]!,
  }));
}
function pickUnused<T>(options: T[], used: T[]) {
  const available = options.filter((option) => !used.includes(option));
  return available[Math.floor(Math.random() * available.length)] ?? options[0]!;
}
export function VideoStudio() {
  const [modelCatalog, setModelCatalog] = useState<ModelRow[]>([]);
  const [sceneModelId, setSceneModelId] = useState('automatic');
  const [story, setStory] = useState(
    'A lone astronaut discovers a glowing forest on a distant planet.',
  );
  const [duration, setDuration] = useState<10 | 15>(10);
  const [ratio, setRatio] = useState<'16:9' | '9:16' | '1:1'>('16:9');
  const [shots, setShots] = useState<VideoShot[]>(initialShots);
  const [shotMode, setShotMode] = useState<ShotMode>('manual');
  const [videoUrl, setVideoUrl] = useState('');
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const [renderProgress, setRenderProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [renderingFilm, setRenderingFilm] = useState(false);
  const [inputMode, setInputMode] = useState<'brief' | 'script'>('brief');
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [voice, setVoice] = useState<FilmInput['voice']>('marin');
  const [voiceModel, setVoiceModel] = useState<FilmInput['voiceModel']>(
    'gpt-realtime-2.1-mini',
  );
  const [resolution, setResolution] = useState<FilmInput['resolution']>('720p');
  const [job, setJob] = useState<FilmJob | null>(null);
  const [jobId, setJobId] = useState(
    () => sessionStorage.getItem('scenecraft:film-job') ?? '',
  );
  const [pollVersion, setPollVersion] = useState(0);
  const [recording, setRecording] = useState<Blob | null>(null);
  const [recordingUrl, setRecordingUrl] = useState('');
  useEffect(
    () => () => {
      if (recordingUrl) URL.revokeObjectURL(recordingUrl);
    },
    [recordingUrl],
  );
  const rendering = useRef<AbortController | null>(null);
  const restoring = useRef(Boolean(jobId));
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const controlsLocked = busy || job?.status === 'preparing';
  const currentInput: FilmInput = {
    script: story.trim(),
    mode: inputMode,
    duration,
    ratio,
    resolution,
    audio: audioEnabled,
    voice,
    voiceModel,
    shots,
    ...(sceneModelId === 'automatic' ? {} : { modelId: sceneModelId }),
  };
  const preparedInputMatches =
    Boolean(job) && JSON.stringify(job!.input) === JSON.stringify(currentInput);
  const totalSeconds = job?.segments.length
    ? job.segments.reduce(
        (total, segment) => total + segment.durationSeconds,
        0,
      )
    : duration;
  const totalCuts = job?.segments.length
    ? job.segments.reduce((total, segment) => total + segment.shots.length, 0)
    : shots.length;
  useEffect(() => {
    if (!jobId) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const current = await loadFilm(jobId);
        if (!active) return;
        setJob(current);
        setBusy(current.status === 'preparing');
        if (restoring.current) {
          const input = current.input;
          setStory(input.script);
          setInputMode(input.mode);
          setShots(input.shots);
          setDuration(input.duration);
          setRatio(input.ratio);
          setResolution(input.resolution);
          setAudioEnabled(input.audio);
          setVoice(input.voice);
          setVoiceModel(input.voiceModel);
          setSceneModelId(input.modelId ?? 'automatic');
          restoring.current = false;
        }
        setStatus(current.stage);
        setError(current.error ?? '');
        if (current.status === 'preparing')
          timer = setTimeout(() => void poll(), 2500);
      } catch (error) {
        if (!active) return;
        setBusy(false);
        setError(
          error instanceof Error ? error.message : 'Cannot load the film job.',
        );
        // A network interruption does not cancel the server-side job.
        timer = setTimeout(() => void poll(), 5000);
      }
    };
    void poll();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [jobId, pollVersion]);
  useEffect(() => () => rendering.current?.abort(), []);
  const eligibleSceneModels = modelCatalog.filter(
    (model) =>
      model.enabled &&
      model.provider === 'openai' &&
      model.capabilities.includes('text') &&
      model.capabilities.includes('structured_output'),
  );
  const assignedSceneModelAvailable =
    sceneModelId === 'automatic' ||
    eligibleSceneModels.some((model) => model.id === sceneModelId);
  const canGenerateScene =
    eligibleSceneModels.length > 0 && assignedSceneModelAvailable;
  const activeSceneModel =
    eligibleSceneModels.find((model) => model.id === sceneModelId) ??
    eligibleSceneModels.find(
      (model) => model.id === RECOMMENDED_SCENE_MODEL_ID,
    ) ??
    eligibleSceneModels[0];

  useEffect(() => {
    void Promise.all([getModels(), getAssignments()])
      .then(([models, assignments]) => {
        setModelCatalog(models);
        setSceneModelId(assignments.scene_planning ?? 'automatic');
      })
      .catch(() => setModelCatalog([]));
  }, []);
  useEffect(
    () => () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
    },
    [videoUrl],
  );

  async function generateVideo(event: React.FormEvent) {
    event.preventDefault();
    if (story.trim().length < 8 || shots.length < 3) return;
    setBusy(true);
    setError('');
    setRenderProgress(0);
    try {
      if (!eligibleSceneModels.length)
        throw new Error(
          'Connect OpenAI and configure an enabled scene-planning model with text and structured output in AI Models before rendering.',
        );
      if (!assignedSceneModelAvailable)
        throw new Error(
          'The assigned scene-planning model is unavailable. Update AI Models or choose Automatic.',
        );
      if (job?.status === 'ready' && preparedInputMatches) {
        await renderPreparedFilm(job);
        return;
      }
      if (job && !preparedInputMatches) await deleteFilm(job.id);
      const current = await startFilm({
        ...currentInput,
      });
      setJob(current);
      setJobId(current.id);
      sessionStorage.setItem('scenecraft:film-job', current.id);
      setStatus(current.stage);
    } catch (error) {
      setBusy(false);
      setStatus('');
      setError(
        error instanceof Error ? error.message : 'Film preparation failed.',
      );
    }
  }
  async function renderPreparedFilm(current: FilmJob) {
    const controller = new AbortController();
    rendering.current = controller;
    setRenderingFilm(true);
    setBusy(true);
    setError('');
    setRenderProgress(0);
    try {
      const webm =
        (videoUrl ? null : recording) ??
        (await renderFilmVideo(
          current.segments,
          current.input.ratio,
          current.input.resolution,
          (progress) => {
            setRenderProgress(progress);
            setStatus(`Three.js rendering · ${progress}% · keep this tab open`);
          },
          controller.signal,
        ));
      setRecording(webm);
      setRecordingUrl(URL.createObjectURL(webm));
      setStatus(
        current.input.audio
          ? 'Combining narration and film into MP4…'
          : 'Encoding MP4…',
      );
      const blob = await encodeFilm(current.id, webm, controller.signal);
      setVideoBlob(blob);
      setVideoUrl(URL.createObjectURL(blob));
      setRenderProgress(100);
      setStatus(
        current.input.audio
          ? 'Your film with AI narration is ready to preview and download.'
          : 'Your Three.js MP4 is ready to preview and download.',
      );
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'Film rendering failed.',
      );
      setStatus('Prepared scenes are kept. Retry rendering or encoding below.');
    } finally {
      setBusy(false);
      rendering.current = null;
      setRenderingFilm(false);
    }
  }
  async function cancelFilm() {
    if (rendering.current) {
      rendering.current.abort();
      return;
    }
    if (!jobId) return;
    try {
      const current = await changeFilm(jobId, 'cancel');
      setJob(current);
      setBusy(false);
      setStatus(current.stage);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not cancel.');
    }
  }
  async function retryPreparation() {
    if (!job) return;
    try {
      setBusy(true);
      setError('');
      const current = await changeFilm(job.id, 'retry');
      setJob(current);
      setBusy(current.status === 'preparing');
      setStatus(current.stage);
      setError(current.error ?? '');
      // A separate version always restarts the effect for this same job ID.
      // Clearing/restoring the ID can be batched into a no-op by React.
      setPollVersion((version) => version + 1);
    } catch (error) {
      setBusy(false);
      setError(error instanceof Error ? error.message : 'Retry failed.');
    }
  }
  async function editSequence() {
    if (
      job &&
      !confirm(
        'Discard the prepared scenes and audio so you can edit this script? Download the finished film first if you want to keep it.',
      )
    )
      return;
    if (job) await deleteFilm(job.id).catch(() => undefined);
    setJob(null);
    setJobId('');
    sessionStorage.removeItem('scenecraft:film-job');
    setRecording(null);
    setRecordingUrl('');
    setVideoBlob(null);
    setVideoUrl('');
    setStatus('');
    setError('');
  }

  function editShot(index: number, key: keyof VideoShot, value: string) {
    setShots((current) =>
      current.map((shot, i) =>
        i === index ? { ...shot, [key]: value } : shot,
      ),
    );
  }

  function moveShot(index: number, offset: -1 | 1) {
    const target = index + offset;
    if (target < 0 || target >= shots.length) return;
    setShots((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });
  }

  function chooseShotMode(mode: ShotMode) {
    setShotMode(mode);
    if (mode === 'random') setShots((current) => randomizeShotChoices(current));
  }

  function addShot() {
    setShots((current) => {
      const next: VideoShot = {
        angle:
          shotMode === 'random'
            ? pickUnused(
                angleOptions,
                current.map((shot) => shot.angle),
              )
            : 'Profile tracking',
        movement:
          shotMode === 'random'
            ? pickUnused(
                movementOptions,
                current.map((shot) => shot.movement),
              )
            : 'Tracking follow',
        action: 'Carry the action into a final cinematic reveal.',
      };
      return [...current, next];
    });
  }

  return (
    <div className="video-studio">
      <header className="video-studio-header">
        <div>
          <p className="eyebrow">DIRECT YOUR NEXT FILM</p>
          <h1>Cinematic video studio</h1>
          <p>
            Turn a story or full script into a narrated film. Direct the shots,
            review the scenes, and render with Three.js.
          </p>
        </div>
        <div className="video-status-pill">
          <span /> Three.js film ·{' '}
          {inputMode === 'script' && (!job || job.status === 'preparing')
            ? 'script length'
            : `${Math.ceil(totalSeconds)}s`}
        </div>
      </header>

      <div className="video-workspace">
        <form
          className="video-controls"
          onSubmit={(event) => void generateVideo(event)}
        >
          <section className="video-card story-card">
            <div className="video-section-title">
              <span className="step-number">01</span>
              <div>
                <h2>Your story</h2>
                <p>Write a brief or paste your complete script.</p>
              </div>
            </div>
            <label className="video-label" htmlFor="film-input-mode">
              Start from
            </label>
            <select
              id="film-input-mode"
              value={inputMode}
              disabled={controlsLocked}
              onChange={(event) =>
                setInputMode(event.target.value as 'brief' | 'script')
              }
            >
              <option value="brief">A short story brief</option>
              <option value="script">
                A long script · automatic scenes and duration
              </option>
            </select>
            <label className="video-label" htmlFor="video-story">
              {inputMode === 'script' ? 'Full script' : 'Story brief'}
            </label>
            <textarea
              id="video-story"
              value={story}
              disabled={controlsLocked}
              maxLength={filmLimits.scriptCharacters}
              onChange={(event) => setStory(event.target.value)}
              placeholder="A vintage racer tears through a rain-soaked Tokyo street at midnight…"
            />
            <div className="story-examples">
              <Sparkles size={13} /> {story.length.toLocaleString()} / 12,000
              characters ·{' '}
              {inputMode === 'script'
                ? 'Paragraphs become scenes. Dialogue and story details guide narration. Up to 12 scenes / 10 minutes.'
                : 'Describe the subject, action, setting and mood. A longer script can use Script mode.'}
            </div>
          </section>

          <section className="video-card shot-card">
            <div className="video-section-title">
              <span className="step-number">02</span>
              <div>
                <h2>Camera sequence</h2>
                <p>Order the cuts and direct every angle.</p>
              </div>
              <span className="shot-count">{shots.length} SHOTS</span>
            </div>
            <fieldset className="shot-mode-picker" disabled={controlsLocked}>
              <legend>How should we choose the camera angles?</legend>
              <label
                className={shotMode === 'random' ? 'is-selected' : ''}
                htmlFor="shot-mode-random"
              >
                <input
                  id="shot-mode-random"
                  type="radio"
                  name="shot-mode"
                  value="random"
                  checked={shotMode === 'random'}
                  onChange={() => chooseShotMode('random')}
                />
                <Sparkles size={14} />
                <span>
                  <strong>Randomize angles</strong>
                  <small>Pick a varied set for me</small>
                </span>
              </label>
              <label
                className={shotMode === 'manual' ? 'is-selected' : ''}
                htmlFor="shot-mode-manual"
              >
                <input
                  id="shot-mode-manual"
                  type="radio"
                  name="shot-mode"
                  value="manual"
                  checked={shotMode === 'manual'}
                  onChange={() => chooseShotMode('manual')}
                />
                <Camera size={14} />
                <span>
                  <strong>Choose manually</strong>
                  <small>Direct each shot yourself</small>
                </span>
              </label>
              <p className="shot-mode-help">
                {shotMode === 'random'
                  ? 'Random picks distinct angles and camera moves. Shuffle again until the sequence feels right.'
                  : 'Select an angle and camera move on every shot.'}
              </p>
            </fieldset>
            {shotMode === 'random' && (
              <button
                className="shuffle-shots-button"
                type="button"
                disabled={controlsLocked}
                onClick={() =>
                  setShots((current) => randomizeShotChoices(current))
                }
              >
                <Shuffle size={14} /> Shuffle angles and moves
              </button>
            )}
            <div className="shot-list">
              {shots.map((shot, index) => (
                <article className="shot-row" key={index}>
                  <div className="shot-index">
                    {String(index + 1).padStart(2, '0')}
                  </div>
                  <div className="shot-fields">
                    <div className="shot-selects">
                      <label>
                        Angle
                        <select
                          value={shot.angle}
                          disabled={controlsLocked || shotMode === 'random'}
                          onChange={(event) =>
                            editShot(index, 'angle', event.target.value)
                          }
                        >
                          {angleOptions.map((option) => (
                            <option key={option}>{option}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Camera move
                        <select
                          value={shot.movement}
                          disabled={controlsLocked || shotMode === 'random'}
                          onChange={(event) =>
                            editShot(index, 'movement', event.target.value)
                          }
                        >
                          {movementOptions.map((option) => (
                            <option key={option}>{option}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <label className="shot-action">
                      What happens in this shot
                      <input
                        maxLength={200}
                        disabled={controlsLocked}
                        value={shot.action}
                        onChange={(event) =>
                          editShot(index, 'action', event.target.value)
                        }
                      />
                    </label>
                  </div>
                  <div className="shot-order">
                    <button
                      type="button"
                      aria-label={`Move shot ${index + 1} up`}
                      disabled={index === 0 || controlsLocked}
                      onClick={() => moveShot(index, -1)}
                    >
                      <ArrowUp size={13} />
                    </button>
                    <button
                      type="button"
                      aria-label={`Move shot ${index + 1} down`}
                      disabled={index === shots.length - 1 || controlsLocked}
                      onClick={() => moveShot(index, 1)}
                    >
                      <ArrowDown size={13} />
                    </button>
                    <button
                      type="button"
                      aria-label={`Remove shot ${index + 1}`}
                      disabled={shots.length <= 3 || controlsLocked}
                      onClick={() =>
                        setShots((current) =>
                          current.filter((_, i) => i !== index),
                        )
                      }
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
            <button
              type="button"
              className="add-shot-button"
              disabled={shots.length >= 5 || controlsLocked}
              onClick={addShot}
            >
              <Plus size={14} /> Add shot
            </button>
          </section>

          <section className="video-card render-card">
            <div className="video-section-title">
              <span className="step-number">03</span>
              <div>
                <h2>Film format</h2>
                <p>Picture quality, voice and pacing.</p>
              </div>
            </div>
            <div className="render-options">
              <label>
                Length
                <select
                  value={duration}
                  disabled={controlsLocked || inputMode === 'script'}
                  onChange={(event) =>
                    setDuration(Number(event.target.value) as 10 | 15)
                  }
                >
                  <option value={10}>
                    {inputMode === 'script'
                      ? 'Follows script and narration'
                      : '10 seconds'}
                  </option>
                  <option value={15}>15 seconds</option>
                </select>
              </label>
              <label>
                Frame
                <select
                  value={ratio}
                  disabled={controlsLocked}
                  onChange={(event) =>
                    setRatio(event.target.value as typeof ratio)
                  }
                >
                  <option value="16:9">Landscape · 16:9</option>
                  <option value="9:16">Portrait · 9:16</option>
                  <option value="1:1">Square · 1:1</option>
                </select>
              </label>
            </div>
            <div className="render-options film-audio-options">
              <label>
                Resolution
                <select
                  value={resolution}
                  disabled={controlsLocked}
                  onChange={(event) =>
                    setResolution(event.target.value as FilmInput['resolution'])
                  }
                >
                  <option value="720p">HD · 720p</option>
                  <option value="1080p">Full HD · 1080p</option>
                </select>
              </label>
              <label>
                Audio
                <select
                  value={String(audioEnabled)}
                  disabled={controlsLocked}
                  onChange={(event) =>
                    setAudioEnabled(event.target.value === 'true')
                  }
                >
                  <option value="true">AI narration</option>
                  <option value="false">Silent</option>
                </select>
              </label>
              {audioEnabled && (
                <>
                  <label>
                    Narrator
                    <select
                      value={voice}
                      disabled={controlsLocked}
                      onChange={(event) =>
                        setVoice(event.target.value as FilmInput['voice'])
                      }
                    >
                      <option value="marin">Marin</option>
                      <option value="cedar">Cedar</option>
                      <option value="coral">Coral</option>
                    </select>
                  </label>
                  <label>
                    Voice model
                    <select
                      value={voiceModel}
                      disabled={controlsLocked}
                      onChange={(event) =>
                        setVoiceModel(
                          event.target.value as FilmInput['voiceModel'],
                        )
                      }
                    >
                      <option value="gpt-realtime-2.1-mini">
                        Realtime 2.1 Mini
                      </option>
                      <option value="gpt-realtime-2.1">Realtime 2.1</option>
                    </select>
                  </label>
                </>
              )}
            </div>
            {audioEnabled && (
              <p className="film-note">
                AI-generated voice. Narration uses the same OpenAI connection
                and incurs additional audio usage. Scene lengths extend to fit
                the speech; no voice cloning or lip sync.
              </p>
            )}
            <div className="provider-setup">
              <p>
                OpenAI creates the structured scene from your story. Three.js
                then animates and renders every frame locally in your browser.
                {activeSceneModel
                  ? `Scene planner: ${activeSceneModel.label}${sceneModelId === 'automatic' ? ' (automatic)' : ''}. `
                  : 'GPT-6.1 Sol is recommended for scene planning. '}
                Each script section gets its own animated scene, with consistent
                art direction. Review the prepared scenes and narration before
                rendering. FFmpeg combines the recording and voice into MP4.
                Your script and narration are sent to OpenAI; background
                responses are temporarily retained for polling.
              </p>
              {!canGenerateScene && (
                <p role="status">
                  {eligibleSceneModels.length
                    ? 'The current scene-planning assignment is unavailable. Choose Automatic or an enabled OpenAI text + structured-output model in AI Models.'
                    : 'Connect OpenAI, add GPT-6.1 Sol (recommended) or another compatible model, and assign it to Scene planning in AI Models to enable rendering.'}
                </p>
              )}
              <Link to="/ai-models">
                Manage scene-planning models <span>↗</span>
              </Link>
            </div>
            <button
              className="render-button"
              type="submit"
              disabled={
                busy ||
                story.trim().length < 8 ||
                shots.length < 3 ||
                ((job?.status === 'failed' || job?.status === 'canceled') &&
                  preparedInputMatches)
              }
            >
              {busy ? (
                <>
                  <span className="render-spinner" />{' '}
                  {renderingFilm
                    ? `Rendering ${renderProgress}%…`
                    : `Preparing scene ${Math.min((job?.completedScenes ?? 0) + 1, job?.totalScenes ?? 1)}…`}
                </>
              ) : (
                <>
                  <Clapperboard size={17} />{' '}
                  {job?.status === 'ready' && preparedInputMatches
                    ? videoUrl
                      ? 'Render again'
                      : recording
                        ? 'Retry MP4 encoding'
                        : 'Render prepared film'
                    : audioEnabled
                      ? job?.status === 'ready'
                        ? 'Prepare updated film'
                        : 'Prepare scenes & narration'
                      : 'Prepare scenes'}
                </>
              )}
            </button>
            {busy && (
              <button
                className="edit-sequence-button"
                type="button"
                onClick={() => void cancelFilm()}
              >
                Cancel current step
              </button>
            )}
            {(job?.status === 'failed' || job?.status === 'canceled') &&
              preparedInputMatches &&
              !busy && (
                <button
                  className="edit-sequence-button"
                  type="button"
                  onClick={() => void retryPreparation()}
                >
                  Retry unfinished scene
                </button>
              )}
            {job && !busy && !videoUrl && (
              <button
                className="edit-sequence-button"
                type="button"
                onClick={() => void editSequence()}
              >
                Edit script and settings
              </button>
            )}
            {job && !preparedInputMatches && !busy && (
              <p className="video-progress" role="status">
                Your prompt or settings changed. Prepare an updated film to use
                them. The current video stays available until the next render.
              </p>
            )}
            {status && (
              <p className="video-progress" role="status">
                {status}
              </p>
            )}
            {recording && error && !busy && (
              <a
                className="edit-sequence-button"
                href={recordingUrl}
                download="scenecraft-picture-only.webm"
              >
                Download picture-only WebM
              </a>
            )}
            {error && (
              <p className="video-error" role="alert">
                {error}
              </p>
            )}
          </section>
        </form>

        <aside className="video-output-column">
          <section
            className={`video-output-card ${videoUrl ? 'has-video' : ''}`}
          >
            {videoUrl ? (
              <>
                <video
                  controls
                  playsInline
                  preload="metadata"
                  style={{
                    aspectRatio:
                      ratio === '9:16'
                        ? '9 / 16'
                        : ratio === '1:1'
                          ? '1 / 1'
                          : '16 / 9',
                  }}
                  src={videoUrl}
                />
                <div className="video-result-details">
                  <div>
                    <span className="result-kicker">
                      THREE.JS RENDER COMPLETE
                    </span>
                    <h2>Your cinematic sequence</h2>
                    <p>
                      {job?.segments.length ?? 1} scenes · {totalCuts} cuts ·{' '}
                      {Math.ceil(totalSeconds)} seconds · {ratio} ·{' '}
                      {audioEnabled ? 'AI narration' : 'silent'} MP4
                    </p>
                  </div>
                  <a
                    className="download-video"
                    href={videoUrl}
                    download={`scenecraft-film.${videoBlob?.type === 'video/mp4' ? 'mp4' : 'webm'}`}
                  >
                    <Download size={15} /> Download{' '}
                    {videoBlob?.type === 'video/mp4' ? 'MP4' : 'WebM'}
                  </a>
                  <button
                    className="edit-sequence-button"
                    type="button"
                    onClick={() => void editSequence()}
                  >
                    Edit sequence
                  </button>
                </div>
              </>
            ) : (
              <div className="video-output-empty">
                <div className="viewfinder">
                  <span />
                  <span />
                  <span />
                  <span />
                  <Camera size={30} />
                </div>
                <span className="output-overline">
                  <Video size={13} /> FINAL OUTPUT
                </span>
                <h2>Your film will appear here</h2>
                <p>
                  Direct the sequence on the left. The finished video will play
                  here and download as an MP4. Three.js renders the animated
                  scene and directed camera cuts locally.
                </p>
                <div className="format-chips">
                  <span>
                    <Film size={12} /> MP4
                  </span>
                  <span>Script → scenes → film</span>
                  <span>Three.js · local</span>
                </div>
              </div>
            )}
          </section>
          {job && (
            <section
              className="video-card film-scene-list"
              aria-label="Prepared script scenes"
            >
              <div className="video-section-title">
                <span className="step-number">FILM</span>
                <div>
                  <h2>Script scenes</h2>
                  <p>
                    {job.completedScenes} / {job.totalScenes} prepared ·{' '}
                    {job.modelId}
                  </p>
                </div>
              </div>
              {job.segments.map((segment, index) => (
                <details key={index}>
                  <summary>
                    <span>{String(index + 1).padStart(2, '0')}</span>{' '}
                    {segment.title}{' '}
                    <small>{Math.ceil(segment.durationSeconds)}s</small>
                  </summary>
                  <p>
                    {segment.narration || 'Visual scene without narration.'}
                  </p>
                  {segment.audioUrl && (
                    <audio
                      controls
                      preload="none"
                      src={segment.audioUrl}
                      aria-label={`AI narration for scene ${index + 1}`}
                    />
                  )}
                </details>
              ))}
              {job.status === 'preparing' && (
                <p className="film-note">
                  {job.stage} You can leave this page and return while
                  preparation continues. Review scenes before rendering.
                </p>
              )}
            </section>
          )}
          <div className="sequence-strip" aria-label="Shot sequence preview">
            <div className="sequence-strip-head">
              <span>SHOT ORDER</span>
              <span>
                {totalCuts} CUTS ·{' '}
                {inputMode === 'script' && (!job || job.status === 'preparing')
                  ? 'SCRIPT PACING'
                  : `${Math.ceil(totalSeconds)} SEC`}
              </span>
            </div>
            <div className="sequence-cells">
              {shots.map((shot, index) => (
                <div className="sequence-cell" key={index}>
                  <div className={`sequence-frame frame-${index % 4}`}>
                    <Camera size={15} />
                    <span>{String(index + 1).padStart(2, '0')}</span>
                  </div>
                  <strong>{shot.angle}</strong>
                  <small>{shot.movement}</small>
                </div>
              ))}
            </div>
          </div>
          <p className="video-footnote">
            The finished video is rendered with Three.js from an animated 3D
            scene using the camera directions above.
          </p>
        </aside>
      </div>
    </div>
  );
}
