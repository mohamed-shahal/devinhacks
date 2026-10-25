import { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  ChevronDown,
  KeyRound,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import {
  assignTask,
  addConnection,
  deleteConnection,
  deleteModel,
  getAssignments,
  getCatalog,
  getConnections,
  getModels,
  saveModel,
  testConnection,
  updateConnection,
} from '../../api/studio';
import type { Connection, ModelRow } from '../../api/studio';
import { RECOMMENDED_SCENE_MODEL_ID } from '@scenecraft/shared';
const tasks = [
  ['scene_planning', 'Scene planning'],
  ['reference_analysis', 'Reference image'],
  ['animation_planning', 'Animation planning'],
  ['scene_refinement', 'Chat refinement'],
  ['scene_repair', 'Scene repair'],
] as const;
const caps = [
  'text',
  'image_input',
  'structured_output',
  'streaming',
  'tool_calling',
  'video_generation',
];
export function AIModels() {
  const [connections, setConnections] = useState<Connection[]>([]),
    [models, setModels] = useState<ModelRow[]>([]),
    [assignments, setAssignments] = useState<Record<string, string>>({}),
    [label, setLabel] = useState('OpenAI'),
    [provider, setProvider] = useState<'openai' | 'runway'>('openai'),
    [apiKey, setApiKey] = useState(''),
    [modelId, setModelId] = useState(''),
    [modelLabel, setModelLabel] = useState(''),
    [selected, setSelected] = useState(''),
    [selectedCaps, setSelectedCaps] = useState<string[]>([
      'text',
      'structured_output',
    ]),
    [catalog, setCatalog] = useState<
      Array<{ id: string; label: string; owner: string }>
    >([]),
    [showModelForm, setShowModelForm] = useState(false),
    [status, setStatus] = useState(''),
    [busy, setBusy] = useState(false);
  const refresh = useCallback(async () => {
    try {
      const [c, m, a] = await Promise.all([
        getConnections(),
        getModels(),
        getAssignments(),
      ]);
      setConnections(c);
      setModels(m);
      setAssignments(a);
      if (!selected && c[0]) setSelected(c[0].id);
    } catch (e) {
      setStatus(
        e instanceof Error ? e.message : 'Could not load model settings.',
      );
    }
  }, [selected]);
  useEffect(() => {
    const task = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(task);
  }, [refresh]);
  async function run(fn: () => Promise<unknown>, message: string) {
    setBusy(true);
    setStatus('');
    try {
      const result = await fn();
      if (message) setStatus(message);
      await refresh();
      return result;
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Action failed.');
      return null;
    } finally {
      setBusy(false);
    }
  }
  async function connect(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim() || apiKey.length < 20) return;
    const result = await run(
      () => addConnection(label, apiKey, provider),
      'Connection saved. The key is encrypted locally and will not be shown again.',
    );
    if (result) {
      setApiKey('');
    }
  }
  async function refreshCatalog(id: string) {
    const result = await run(
      () => getCatalog(id),
      'Catalog loaded from the provider. Select a model to configure capabilities.',
    );
    if (Array.isArray(result)) setCatalog(result as typeof catalog);
  }
  async function saveSelectedModel() {
    if (!selected || !modelId.trim()) return;
    await run(
      () =>
        saveModel(selected, {
          id: modelId.trim(),
          label: modelLabel.trim() || modelId.trim(),
          capabilities: selectedCaps,
        }),
      `Saved ${modelLabel || modelId}. Capabilities were set explicitly.`,
    );
    setModelId('');
    setModelLabel('');
  }
  const available = models.filter((m) => m.enabled);
  return (
    <>
      <div className="page-intro">
        <div>
          <p className="eyebrow">Your tools, your choices</p>
          <h1>AI Models</h1>
          <p>
            Store a provider key locally, configure GPT-6.1 Sol for scene
            planning, and assign other tasks explicitly.
          </p>
        </div>
      </div>
      <div className="models-layout">
        <section className="content-panel models-main">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Encrypted on this device</p>
              <h2>Provider connections</h2>
            </div>
          </div>
          <form className="connection-form" onSubmit={(e) => void connect(e)}>
            <label>
              Provider
              <select
                aria-label="Provider"
                value={provider}
                onChange={(e) => {
                  const next = e.target.value as 'openai' | 'runway';
                  setProvider(next);
                  setLabel(next === 'runway' ? 'Runway' : 'OpenAI');
                }}
              >
                <option value="openai">OpenAI · scene planning</option>
                <option value="runway">Runway · cinematic video</option>
              </select>
            </label>
            <label>
              Connection name
              <input
                value={label}
                maxLength={80}
                onChange={(e) => setLabel(e.target.value)}
              />
            </label>
            <label>
              {provider === 'runway' ? 'Runway API key' : 'OpenAI API key'}
              <input
                type="password"
                autoComplete="new-password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Entered once; never displayed again"
                minLength={20}
                maxLength={4096}
              />
            </label>
            <button
              className="button primary"
              disabled={busy || apiKey.length < 20}
            >
              <KeyRound size={15} /> Add connection
            </button>
            <p>
              Key is sent to the local API for encryption and later sent to
              {provider === 'runway' ? 'Runway' : 'OpenAI'} only for provider
              requests.
            </p>
          </form>
          {connections.length > 0 && (
            <div className="connection-list">
              {connections.map((c) => (
                <article key={c.id} className="connection-card">
                  <div className="connection-title">
                    <span
                      className={`status-dot ${c.enabled ? 'online' : ''}`}
                      aria-hidden="true"
                    />
                    <div>
                      <h3>{c.label}</h3>
                      <p>
                        {c.provider === 'runway' ? 'Runway' : 'OpenAI'} ·{' '}
                        {c.hasCredential
                          ? 'Credential saved'
                          : 'Credential missing'}
                      </p>
                    </div>
                    <span className="tag">
                      {c.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                  <div className="connection-actions">
                    <button
                      className="button"
                      disabled={busy || !c.enabled}
                      onClick={() =>
                        void run(
                          () => testConnection(c.id),
                          'Provider accepted the credential.',
                        )
                      }
                    >
                      Test connection
                    </button>
                    <button
                      className="button"
                      disabled={busy}
                      onClick={() => void refreshCatalog(c.id)}
                    >
                      <RefreshCw size={13} />{' '}
                      {c.provider === 'runway'
                        ? 'Load video models'
                        : 'Refresh models'}
                    </button>
                    <button
                      className="button"
                      disabled={busy}
                      onClick={() =>
                        void run(
                          () => updateConnection(c.id, { enabled: !c.enabled }),
                          c.enabled
                            ? 'Connection disabled.'
                            : 'Connection enabled.',
                        )
                      }
                      aria-label={`${c.enabled ? 'Disable' : 'Enable'} ${c.label}`}
                    >
                      {c.enabled ? 'Disable' : 'Enable'}
                    </button>
                    <button
                      className="button danger"
                      disabled={busy}
                      aria-label={`Delete ${c.label}`}
                      onClick={() => {
                        if (
                          window.confirm(
                            `Delete ${c.label} and its model assignments?`,
                          )
                        )
                          void run(
                            () => deleteConnection(c.id),
                            'Connection deleted.',
                          );
                      }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
          <div className="section-heading compact">
            <div>
              <p className="eyebrow">Available models</p>
              <h2>Model catalog</h2>
            </div>
          </div>
          <p className="models-help">
            Load a provider catalog from a connection above, then select models
            to verify and configure their capabilities.
          </p>
          {catalog.length > 0 && (
            <div className="catalog-list">
              {catalog.slice(0, 100).map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setModelId(item.id);
                    setModelLabel(item.label);
                    if (item.id === RECOMMENDED_SCENE_MODEL_ID)
                      setSelectedCaps(['text', 'structured_output']);
                    setShowModelForm(true);
                  }}
                >
                  <span>
                    {item.label}
                    {item.id === RECOMMENDED_SCENE_MODEL_ID && (
                      <strong className="recommended-model">Recommended</strong>
                    )}
                  </span>
                  <small>
                    {item.owner} ·{' '}
                    {item.id === RECOMMENDED_SCENE_MODEL_ID
                      ? 'text + structured output supported'
                      : 'capability unknown'}
                  </small>
                </button>
              ))}
            </div>
          )}
          {!catalog.length && (
            <p className="models-empty-note">
              {connections.length
                ? 'Refresh models on a connection to load its catalog.'
                : 'Add a provider connection to load a model catalog.'}
            </p>
          )}
          {connections.length > 0 && (
            <>
              <button
                className="model-form-toggle"
                type="button"
                aria-expanded={showModelForm}
                onClick={() => setShowModelForm((open) => !open)}
              >
                <span>
                  {showModelForm
                    ? 'Hide manual model setup'
                    : 'Add a model manually'}
                </span>
                <ChevronDown
                  size={15}
                  className={showModelForm ? 'is-open' : ''}
                />
              </button>
              {showModelForm && (
                <div className="model-form">
                  <label>
                    Provider connection
                    <select
                      aria-label="Model connection"
                      value={selected}
                      onChange={(e) => setSelected(e.target.value)}
                    >
                      {connections.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Model ID
                    <input
                      value={modelId}
                      onChange={(e) => setModelId(e.target.value)}
                      placeholder="Use an ID returned by Refresh models"
                    />
                  </label>
                  <label>
                    Display name
                    <input
                      value={modelLabel}
                      onChange={(e) => setModelLabel(e.target.value)}
                      placeholder="Optional label"
                    />
                  </label>
                  <fieldset>
                    <legend>Capabilities you verified</legend>
                    <p>
                      Model names alone never establish capability. Confirm
                      support in the provider's documentation before enabling.
                    </p>
                    <div className="capability-checks">
                      {caps.map((cap) => (
                        <label key={cap}>
                          <input
                            type="checkbox"
                            checked={selectedCaps.includes(cap)}
                            onChange={(e) =>
                              setSelectedCaps((s) =>
                                e.target.checked
                                  ? [...s, cap]
                                  : s.filter((x) => x !== cap),
                              )
                            }
                          />
                          {cap.replaceAll('_', ' ')}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <button
                    className="button primary"
                    disabled={busy || !modelId.trim()}
                    onClick={() => void saveSelectedModel()}
                  >
                    <Plus size={14} /> Add configured model
                  </button>
                </div>
              )}
            </>
          )}
          <div className="section-heading compact">
            <div>
              <p className="eyebrow">Your setup</p>
              <h2>Configured models</h2>
            </div>
          </div>
          {models.length ? (
            <div className="configured-model-list">
              {models.map((configured) => (
                <article className="configured-model-row" key={configured.id}>
                  <div>
                    <strong>{configured.label}</strong>
                    <span>
                      {configured.connectionLabel} · {configured.id}
                    </span>
                    <div className="model-capability-list">
                      {configured.capabilities.map((capability) => (
                        <span key={capability}>
                          {capability.replaceAll('_', ' ')}
                        </span>
                      ))}
                    </div>
                  </div>
                  <button
                    className="icon-button danger"
                    type="button"
                    aria-label={`Remove ${configured.label}`}
                    disabled={busy}
                    onClick={() => {
                      if (
                        window.confirm(
                          `Remove ${configured.label}? Any task using it will return to automatic routing.`,
                        )
                      )
                        void run(
                          () => deleteModel(configured.id),
                          `${configured.label} removed.`,
                        );
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <p className="models-empty-note">
              No models configured yet. Load a catalog or add a model manually.
            </p>
          )}
        </section>
        <aside className="models-side">
          <section
            className="assignment-card"
            aria-labelledby="assignment-title"
          >
            <div>
              <p className="eyebrow">Task router</p>
              <h2 id="assignment-title">Task assignments</h2>
              <p className="models-help">
                Choose which configured model handles each task.
              </p>
            </div>
            {!available.length && (
              <p className="models-empty-note">
                Add and enable a model before assigning tasks.
              </p>
            )}
            <div className="assignment-list">
              {tasks.map(([task, title]) => (
                <label key={task}>
                  {title}
                  <select
                    value={assignments[task] ?? 'automatic'}
                    disabled={!available.length || busy}
                    onChange={(e) =>
                      void run(
                        () => assignTask(task, e.target.value),
                        `${title} assignment saved.`,
                      )
                    }
                  >
                    <option value="automatic">Automatic · no fallback</option>
                    {available.map((m) => (
                      <option value={m.id} key={m.id}>
                        {m.label} ·{' '}
                        {m.capabilities.includes('structured_output')
                          ? 'structured'
                          : 'no structured output'}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          </section>
          <div className="content-panel diagnostics">
            <Activity size={18} />
            <h2>Diagnostics</h2>
            <p>{connections.length} provider connections</p>
            <p>{models.length} configured models</p>
            <p>
              Requests are validated, rate limited and logged without prompts or
              credentials.
            </p>
            <button className="button" onClick={() => void refresh()}>
              <RefreshCw size={14} /> Refresh status
            </button>
          </div>
          <div className="notice">
            <KeyRound size={16} /> Local mode only. Hosted credential storage
            remains disabled until authentication, ownership checks and a
            managed key vault are deployed.
          </div>
        </aside>
      </div>
      {status && (
        <div className="toast" role="status">
          {status}
          <button aria-label="Dismiss message" onClick={() => setStatus('')}>
            ×
          </button>
        </div>
      )}
    </>
  );
}
