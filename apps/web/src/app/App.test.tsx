// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from './App';

beforeEach(() => {
  window.localStorage.clear();
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 'ok',
          service: 'scenecraft-api',
          milestone: 'M0',
          mode: 'local-foundation',
        }),
      ),
    ),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderApp(path = '/') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('foundation app', () => {
  it('navigates to models without presenting a working provider integration', async () => {
    renderApp();
    expect(
      screen.getByRole('heading', { name: 'Your scene starts here.' }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('link', { name: 'AI Models' }));
    expect(screen.getByRole('button', { name: 'Add provider' })).toBeDisabled();
    expect(
      screen.getByText(/Credential entry is disabled/),
    ).toBeInTheDocument();
    expect(await screen.findByText('Local API connected')).toBeInTheDocument();
  });
  it('applies and persists a theme preference', async () => {
    renderApp('/settings');
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: 'Appearance' }),
      'light',
    );
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(window.localStorage.getItem('scenecraft:theme')).toBe('light');
  });
  it('recovers from an unknown route', async () => {
    renderApp('/missing');
    await userEvent.click(
      screen.getByRole('link', { name: 'Return to Studio' }),
    );
    expect(
      screen.getByRole('heading', { name: 'Your scene starts here.' }),
    ).toBeInTheDocument();
  });
});
