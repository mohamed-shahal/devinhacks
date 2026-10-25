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
    vi.fn((input: RequestInfo | URL) =>
      String(input).includes('/video-connections')
        ? Promise.resolve(new Response('[]'))
        : Promise.resolve(
            new Response(
              JSON.stringify({
                status: 'ok',
                service: 'scenecraft-api',
                milestone: 'M8',
                mode: 'local-only',
              }),
            ),
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

describe('SceneCraft app', () => {
  it('opens the Three.js video studio and model configuration', async () => {
    renderApp();
    expect(
      screen.getByRole('heading', { name: 'Cinematic video studio' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Camera sequence' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Your film will appear here' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Prepare scenes & narration' }),
    ).toBeEnabled();
    expect(
      await screen.findByText(/Connect OpenAI, add GPT-6\.1 Sol/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/OpenAI creates the structured scene/),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: 'Prepare scenes & narration' }),
    );
    expect(
      await screen.findByText(
        /Connect OpenAI and configure an enabled scene-planning model/,
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('tree', { name: 'Scene hierarchy' }),
    ).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('link', { name: 'AI Models' }));
    expect(
      screen.getByRole('button', { name: 'Add connection' }),
    ).toBeDisabled();
    expect(screen.getByLabelText('OpenAI API key')).toBeInTheDocument();
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: 'Provider' }),
      'runway',
    );
    expect(screen.getByLabelText('Runway API key')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Provider connections' }),
    ).toBeInTheDocument();
  });
  it('applies and persists a theme preference', async () => {
    renderApp('/settings');
    expect(document.documentElement.dataset.theme).toBe('light');
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: 'Appearance' }),
      'dark',
    );
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(window.localStorage.getItem('scenecraft:theme')).toBe('dark');
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
      screen.getByRole('heading', { name: 'Cinematic video studio' }),
    ).toBeInTheDocument();
  });
});
