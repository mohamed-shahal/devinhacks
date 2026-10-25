import { useEffect } from 'react';
import { Link, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  Check,
  Clapperboard,
  Layers3,
  RefreshCw,
  Settings2,
  ShieldCheck,
  Sparkles,
  Workflow,
} from 'lucide-react';
import { getHealth } from '../api/health';
import { Preferences } from '../features/settings/Preferences';
import { useTheme } from '../features/settings/useTheme';
import { roadmap } from './roadmap';
import { Editor } from '../features/studio/Editor';
import { Projects } from '../features/projects/Projects';
import { Assets } from '../features/assets/Assets';
import { AIModels } from '../features/ai-models/AIModels';
import { VideoStudio } from '../features/video/VideoStudio';

const navigation = [
  { to: '/', label: 'Video Studio', icon: Clapperboard },
  { to: '/ai-models', label: 'AI Models', icon: Workflow },
  { to: '/settings', label: 'Settings', icon: Settings2 },
];

function ApiStatus() {
  const health = useQuery({
    queryKey: ['health'],
    queryFn: ({ signal }) => getHealth(signal),
  });
  return (
    <div className="api-status">
      <span
        className={`status-dot ${health.isSuccess ? 'online' : ''}`}
        aria-hidden="true"
      />
      <div role="status">
        <strong>
          {health.isPending
            ? 'Checking local API'
            : health.isSuccess
              ? 'Local API connected'
              : 'Local API offline'}
        </strong>
        <span>
          {health.isError
            ? 'Start npm run dev to connect.'
            : 'Local development API'}
        </span>
      </div>
      <button
        className="icon-button"
        aria-label="Check API connection"
        disabled={health.isFetching}
        onClick={() => {
          void health.refetch();
        }}
      >
        <RefreshCw size={15} className={health.isFetching ? 'spinning' : ''} />
      </button>
    </div>
  );
}

function Roadmap() {
  return (
    <>
      <div className="page-intro">
        <div>
          <p className="eyebrow">Built one working layer at a time</p>
          <h1>The path to SceneCraft.</h1>
          <p>Milestones follow the project’s implementation specification.</p>
        </div>
      </div>
      <section
        className="content-panel roadmap"
        aria-label="Implementation roadmap"
      >
        {roadmap.map((step) => (
          <div
            className={`roadmap-row ${step.id === 'M9' ? 'current' : ''}`}
            key={step.id}
          >
            <span className="milestone-id">{step.id}</span>
            <div>
              <h2>{step.name}</h2>
              <p>{step.scope}</p>
            </div>
            <span className="tag">{step.state}</span>
          </div>
        ))}
      </section>
    </>
  );
}

export function App() {
  const { theme, setTheme, storageError } = useTheme();
  const location = useLocation();
  const activeTitle =
    navigation.find((item) => item.to === location.pathname)?.label ??
    (location.pathname === '/scene-editor'
      ? '3D Scene Editor'
      : location.pathname === '/projects'
        ? 'Scene Projects'
        : location.pathname === '/assets'
          ? 'Scene Assets'
          : location.pathname === '/roadmap'
            ? 'Build plan'
            : 'Page not found');
  useEffect(() => {
    document.title = `SceneCraft AI · ${activeTitle}`;
  }, [activeTitle]);
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <aside className="sidebar">
        <Link to="/" className="brand" aria-label="SceneCraft AI home">
          <span className="brand-mark">
            <Layers3 size={22} />
          </span>
          <span>
            SceneCraft<span className="brand-ai">AI</span>
          </span>
        </Link>
        <p className="nav-label">Workspace</p>
        <nav aria-label="Main navigation">
          {navigation.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end
              className={({ isActive }) =>
                `nav-item ${isActive ? 'active' : ''}`
              }
            >
              <Icon size={18} />
              <span>{label}</span>
              {label === 'Studio' && <span className="nav-indicator" />}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="foundation-note">
            <span className="step-label">
              <Sparkles size={13} /> In development
            </span>
            <h2>Cut the story in camera.</h2>
            <p>
              Direct a sequence of cinematic angles and render the finished
              video.
            </p>
            <Link to="/roadmap">
              Build plan <ArrowRight size={14} />
            </Link>
          </div>
          <div className="local-label">
            <ShieldCheck size={14} /> Local development
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <span>/</span> <strong>{activeTitle}</strong>
          </div>
          <span className="release-label">
            <Check size={13} /> Local MVP
          </span>
        </header>
        <main id="main-content" tabIndex={-1}>
          <Routes>
            <Route path="/" element={<VideoStudio />} />
            <Route path="/scene-editor" element={<Editor />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/assets" element={<Assets />} />
            <Route path="/ai-models" element={<AIModels />} />
            <Route
              path="/settings"
              element={
                <>
                  <div className="page-intro">
                    <div>
                      <p className="eyebrow">Make yourself at home</p>
                      <h1>Settings</h1>
                      <p>Your preferences and data controls.</p>
                    </div>
                  </div>
                  <Preferences
                    theme={theme}
                    onChange={setTheme}
                    storageError={storageError}
                  />
                </>
              }
            />
            <Route path="/roadmap" element={<Roadmap />} />
            <Route
              path="*"
              element={
                <section className="feature-empty">
                  <h1>Page not found</h1>
                  <Link className="button primary" to="/">
                    Return to Studio
                  </Link>
                </section>
              }
            />
          </Routes>
        </main>
        <footer className="app-footer">
          <span>
            SceneCraft AI <span className="footer-divider">/</span> Imagine.
            Shape. Animate.
          </span>
          <ApiStatus />
        </footer>
      </div>
    </div>
  );
}
