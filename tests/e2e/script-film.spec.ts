import { expect, test } from '@playwright/test';
import { preset } from '../../packages/scene-schema/src/presets';
import type { FilmInput, FilmJob } from '../../packages/scene-schema/src/film';

const id = 'e5d56187-0328-4e0c-bd1d-f3357ad5f417';
const script =
  'SCENE 1 — FOREST\n' +
  'The explorer follows the lantern into the trees. '.repeat(10) +
  '\n\nSCENE 2 — BRIDGE\nThe light leads her home.';
test('long script and narration preparation can resume and retry without losing scenes', async ({
  page,
}) => {
  let input: FilmInput;
  let retried = false;
  const failed = (): FilmJob => ({
    id,
    input,
    status: retried ? 'ready' : 'failed',
    stage: retried
      ? 'Scenes and audio are ready. Render your film.'
      : 'Preparation paused.',
    modelId: 'configured-model',
    completedScenes: retried ? 2 : 1,
    totalScenes: 2,
    updatedAt: Date.now(),
    error: retried ? null : 'Narration timed out. Retry the unfinished scene.',
    segments: Array.from({ length: retried ? 2 : 1 }, (_, index) => ({
      title: index ? 'The bridge' : 'The forest',
      narration: index
        ? 'The lantern leads her home.'
        : 'In the forest, a light waited.',
      durationSeconds: 8,
      focusId: null,
      scene: preset('Neon robot'),
      shots: input.shots,
      audioUrl: `/api/v1/films/${id}/audio/${index}`,
    })),
  });
  await page.route('**/api/v1/models', (route) =>
    route.fulfill({
      json: [
        {
          id: 'configured-model',
          connectionId: 'test',
          label: 'Configured scene model',
          capabilities: ['text', 'structured_output'],
          connectionLabel: 'OpenAI',
          provider: 'openai',
          enabled: 1,
        },
      ],
    }),
  );
  await page.route('**/api/v1/task-assignments', (route) =>
    route.fulfill({ json: { scene_planning: 'configured-model' } }),
  );
  await page.route('**/api/v1/films', async (route) => {
    input = route.request().postDataJSON() as FilmInput;
    await route.fulfill({
      status: 202,
      json: { ...failed(), status: 'preparing', error: null },
    });
  });
  await page.route(`**/api/v1/films/${id}`, (route) =>
    route.fulfill({ json: failed() }),
  );
  await page.route(`**/api/v1/films/${id}/retry`, (route) => {
    retried = true;
    return route.fulfill({ status: 202, json: failed() });
  });
  await page.goto('/');
  await page.getByLabel('Start from').selectOption('script');
  await page.getByLabel('Full script').fill(script);
  await page.getByRole('combobox', { name: /^Narrator/ }).selectOption('cedar');
  await expect(page.getByLabel('Length')).toBeDisabled();
  await page
    .getByRole('button', { name: 'Prepare scenes & narration' })
    .click();
  await expect(
    page.getByRole('button', { name: 'Retry unfinished scene' }),
  ).toBeVisible();
  expect(input!.script).toBe(script);
  expect(input!.script.length).toBeGreaterThan(250);
  expect(input!.audio).toBe(true);
  expect(input!.voice).toBe('cedar');
  await page.reload();
  await expect(page.getByLabel('Full script')).toHaveValue(script);
  await expect(
    page.locator('.film-scene-list summary').filter({ hasText: 'The forest' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Retry unfinished scene' }).click();
  await expect(
    page.getByRole('button', { name: 'Render prepared film' }),
  ).toBeEnabled();
  await expect(
    page.locator('.film-scene-list summary').filter({ hasText: 'The bridge' }),
  ).toBeVisible();
  await page
    .locator('.film-scene-list details')
    .first()
    .locator('summary')
    .click();
  await expect(page.locator('audio').first()).toHaveAttribute(
    'src',
    `/api/v1/films/${id}/audio/0`,
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
