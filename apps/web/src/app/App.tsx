import { useEffect } from 'react';
import { Link, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  Box,
  Boxes,
  Check,
  CircleHelp,
  FolderOpen,
  Layers3,
  Monitor,
  Orbit,
  RefreshCw,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Workflow,
} from 'lucide-react';
import { getHealth } from '../api/health';
import { Preferences } from '../features/settings/Preferences';
import { useTheme } from '../features/settings/useTheme';
import { roadmap } from './roadmap';

const navigation = [
  { to: '/', label: 'Studio', icon: Orbit },
  { to: '/projects', label: 'Projects', icon: FolderOpen },
  { to: '/assets', label: 'Assets', icon: Boxes },
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
            : 'Foundation · No provider connected'}
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

function Studio() {
  return (
    <>
      <div className="page-intro">
        <div>
          <p className="eyebrow">From an idea to a world</p>
          <h1>Your scene starts here.</h1>
          <p>A workspace for editable, animated 3D scenes.</p>
        </div>
        <span className="tag">Foundation · M0</span>
      </div>
      <div className="studio-layout">
        <section className="viewport-empty" aria-labelledby="viewport-title">
          <div className="viewport-label">
            <span>
              <Monitor size={14} /> Studio workspace
            </span>
            <span>Renderer arrives in M1</span>
          </div>
          <div className="empty-stage">
            <div className="scene-symbol" aria-hidden="true">
              <Box strokeWidth={1} size={70} />
              <span className="axis axis-x">X</span>
              <span className="axis axis-y">Y</span>
              <span className="axis axis-z">Z</span>
            </div>
            <p className="eyebrow">A blank canvas. A clear beginning.</p>
            <h2 id="viewport-title">Make room for your imagination.</h2>
            <p>
              The foundation is ready. Validated scene presets and the live 3D
              viewport are the next milestone.
            </p>
            <Link className="button primary" to="/roadmap">
              Explore the build plan <ArrowRight size={16} />
            </Link>
          </div>
          <div className="viewport-footer">
            <span>
              <ShieldCheck size={14} /> Structured scenes. No generated scripts.
            </span>
            <span>No scene loaded</span>
          </div>
        </section>
        <aside className="side-panel" aria-labelledby="workspace-title">
          <div className="panel-label">
            <SlidersHorizontal size={15} />
            <h2 id="workspace-title">Workspace</h2>
          </div>
          <div className="workspace-state">
            <span className="small-icon">
              <Layers3 size={22} />
            </span>
            <h3>Ready for the first scene</h3>
            <p>
              Scene tools will become available as each milestone is completed.
            </p>
          </div>
          <div className="upcoming-feature">
            <span className="step-label">Next · M1</span>
            <h3>Build the scene engine</h3>
            <p>
              Primitives, a procedural robot, lighting and a camera. All driven
              by validated scene data.
            </p>
          </div>
          <div className="upcoming-feature">
            <span className="step-label">Then · M2</span>
            <h3>Make every detail editable</h3>
            <p>
              Select objects, adjust transforms and explore animation with undo
              and redo.
            </p>
          </div>
          <p className="panel-note">
            <CircleHelp size={15} /> This is the foundation release. Scene
            generation is not available yet.
          </p>
        </aside>
      </div>
      <div className="principles">
        <div>
          <ShieldCheck size={18} />
          <div>
            <h3>Safe by design</h3>
            <p>Validated data drives every scene.</p>
          </div>
        </div>
        <div>
          <Layers3 size={18} />
          <div>
            <h3>Made to be edited</h3>
            <p>Objects and animation stay in your hands.</p>
          </div>
        </div>
        <div>
          <Workflow size={18} />
          <div>
            <h3>Your choice of AI</h3>
            <p>Model configuration arrives in M3.</p>
          </div>
        </div>
      </div>
    </>
  );
}

function FeaturePage({
  eyebrow,
  title,
  description,
  milestone,
  action,
  icon: Icon,
}: {
  eyebrow: string;
  title: string;
  description: string;
  milestone: string;
  action: string;
  icon: typeof Box;
}) {
  return (
    <>
      <div className="page-intro">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
      </div>
      <section className="content-panel feature-empty">
        <Icon size={44} strokeWidth={1} />
        <h2>Available in {milestone}</h2>
        <p>
          This part of the studio is planned and has not been implemented yet.
        </p>
        <button className="button" disabled aria-describedby="feature-reason">
          {action}
        </button>
        <p id="feature-reason" className="muted">
          Requires the {milestone} implementation.
        </p>
        <Link className="text-link" to="/roadmap">
          View milestone acceptance criteria <ArrowRight size={15} />
        </Link>
      </section>
    </>
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
            className={`roadmap-row ${step.id === 'M0' ? 'current' : ''}`}
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
    (location.pathname === '/roadmap' ? 'Build plan' : 'Page not found');
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
            <h2>A world in the making.</h2>
            <p>
              Follow the studio from foundation to your first animated scene.
            </p>
            <Link to="/roadmap">
              Build plan <ArrowRight size={14} />
            </Link>
          </div>
          <div className="local-label">
            <ShieldCheck size={14} /> Local foundation
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <span>/</span> <strong>{activeTitle}</strong>
          </div>
          <span className="release-label">
            <Check size={13} /> Foundation release
          </span>
        </header>
        <main id="main-content" tabIndex={-1}>
          <Routes>
            <Route path="/" element={<Studio />} />
            <Route
              path="/projects"
              element={
                <FeaturePage
                  eyebrow="Your scene library"
                  title="Projects"
                  description="A home for your scenes, revisions and ideas."
                  milestone="Milestone 7"
                  action="New project"
                  icon={FolderOpen}
                />
              }
            />
            <Route
              path="/assets"
              element={
                <FeaturePage
                  eyebrow="The building blocks"
                  title="Assets"
                  description="Procedural presets and validated local imports."
                  milestone="Milestone 6"
                  action="Import asset"
                  icon={Boxes}
                />
              }
            />
            <Route
              path="/ai-models"
              element={
                <>
                  <FeaturePage
                    eyebrow="Choose the intelligence behind your scenes"
                    title="AI Models"
                    description="Provider connections, model capabilities and task assignments."
                    milestone="Milestone 3"
                    action="Add provider"
                    icon={Workflow}
                  />
                  <p className="notice">
                    <ShieldCheck size={16} /> Credential entry is disabled until
                    authentication, encryption and ownership checks are
                    implemented. No AI provider is connected.
                  </p>
                </>
              }
            />
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
