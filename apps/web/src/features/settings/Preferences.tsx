import type { Theme } from './useTheme';

export function Preferences({
  theme,
  onChange,
  storageError,
}: {
  theme: Theme;
  onChange: (theme: Theme) => void;
  storageError: boolean;
}) {
  return (
    <section className="content-panel" aria-labelledby="preferences-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Your workspace</p>
          <h2 id="preferences-title">Preferences</h2>
        </div>
      </div>
      <div className="setting-row">
        <div>
          <h3>Appearance</h3>
          <p>Choose a theme for this browser.</p>
        </div>
        <label className="sr-only" htmlFor="theme">
          Appearance
        </label>
        <select
          id="theme"
          value={theme}
          onChange={(event) =>
            onChange(event.target.value === 'light' ? 'light' : 'dark')
          }
        >
          <option value="dark">Dark studio</option>
          <option value="light">Light studio</option>
        </select>
      </div>
      {storageError && (
        <p role="status" className="notice">
          Browser storage is unavailable. Your theme applies for this session.
        </p>
      )}
      <div className="setting-row">
        <div>
          <h3>Privacy</h3>
          <p>
            Projects and imported assets stay in this browser. Prompts and
            attached images are sent to OpenAI only when you choose real
            generation; demo templates stay local. Provider keys are encrypted
            by the local API and are not shown again after saving.
          </p>
        </div>
      </div>
      <div className="setting-row">
        <div>
          <h3>Scene autosave & render quality</h3>
          <p>
            Scene changes autosave to browser storage. Render quality can be
            changed in the Studio header. Clear browser site data to remove
            local projects and assets.
          </p>
        </div>
      </div>
    </section>
  );
}
