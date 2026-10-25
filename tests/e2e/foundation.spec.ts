import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('Three.js video studio and scene-model setup are clear on desktop and mobile', async ({
  page,
}) => {
  await page.route('**/api/v1/models', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/v1/task-assignments', (route) =>
    route.fulfill({ json: {} }),
  );
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Cinematic video studio' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Camera sequence' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Your film will appear here' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Prepare scenes & narration' }),
  ).toBeEnabled();
  await expect(
    page.getByText(/Connect OpenAI, add GPT-6\.1 Sol/),
  ).toBeVisible();
  await expect(
    page.getByText(/OpenAI creates the structured scene/),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Prepare scenes & narration' })
    .click();
  await expect(
    page.getByRole('alert').getByText(/Connect OpenAI and configure/),
  ).toBeVisible();
  await expect(page.locator('.viewport-live')).toHaveCount(0);
  await page.getByRole('radio', { name: /Randomize angles/ }).check();
  await expect(
    page.getByRole('button', { name: /Shuffle angles and moves/ }),
  ).toBeVisible();
  const angleValues = await page
    .locator('.shot-row')
    .evaluateAll((rows) =>
      rows.map(
        (row) => (row.querySelectorAll('select')[0] as HTMLSelectElement).value,
      ),
    );
  const movementValues = await page
    .locator('.shot-row')
    .evaluateAll((rows) =>
      rows.map(
        (row) => (row.querySelectorAll('select')[1] as HTMLSelectElement).value,
      ),
    );
  expect(new Set(angleValues).size).toBe(angleValues.length);
  expect(new Set(movementValues).size).toBe(movementValues.length);
  await page.getByRole('button', { name: /Shuffle angles and moves/ }).click();
  await page.getByRole('radio', { name: /Choose manually/ }).check();
  await expect(page.locator('.shot-row select').first()).toBeEnabled();
  await page
    .locator('.shot-row select')
    .first()
    .selectOption({ label: 'Dutch angle' });
  await expect(page.locator('.shot-row select').first()).toHaveValue(
    'Dutch angle',
  );
  await page.getByRole('button', { name: 'Add shot' }).click();
  await expect(page.locator('.shot-row')).toHaveCount(4);
  await page.getByRole('button', { name: 'Remove shot 4' }).click();
  await expect(page.locator('.shot-row')).toHaveCount(3);
  await expect(
    page.getByRole('button', { name: 'Remove shot 1' }),
  ).toBeDisabled();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole('navigation')
    .getByRole('link', { name: 'AI Models' })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Provider connections' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Model catalog' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Task assignments' }),
  ).toBeVisible();
  await page.getByLabel('Provider').selectOption('runway');
  await expect(page.getByLabel('Runway API key')).toBeVisible();
  await expect(
    page.getByText(/Runway only for provider requests/),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test('legacy scene editor flows remain functional without provider credentials', async ({
  page,
}) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('scenecraft:e2e-initialized')) {
      localStorage.clear();
      sessionStorage.setItem('scenecraft:e2e-initialized', '1');
    }
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      value: () => null,
    });
  });
  await page.goto('/scene-editor');
  await expect(
    page.getByRole('textbox', { name: 'Describe a scene' }),
  ).toBeVisible();
  const prompt = page.getByRole('textbox', { name: 'Describe a scene' });
  await prompt.fill('A tiny robot dancing under neon lights');
  await page.getByRole('button', { name: 'Try demo' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Demo mode' }),
  ).toBeVisible();
  await expect(
    page.getByRole('tree', { name: 'Scene hierarchy' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Refine' }).click();
  await page
    .getByRole('textbox', { name: 'Refinement instruction' })
    .fill('Make it taller');
  await page.getByRole('button', { name: 'Try demo refinement' }).click();
  await expect(
    page.getByRole('heading', { name: 'Review change' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Apply change' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Made' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Undo' }).click();
  await page.getByRole('button', { name: 'Redo' }).click();
  await page.getByRole('button', { name: 'Scene', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Project name' })
    .fill('E2E saved scene');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Saved locally')).toBeVisible();
  await page.getByRole('button', { name: 'Export' }).click();
  const downloadReady = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Scene JSON' }).click();
  expect((await downloadReady).suggestedFilename()).toMatch(/\.json$/);
  await page.getByRole('button', { name: 'Export' }).click();
  const standaloneDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Standalone HTML' }).click();
  const standalone = await standaloneDownload;
  expect(standalone.suggestedFilename()).toMatch(/\.html$/);
  const artifact = await readFile((await standalone.path())!, 'utf8');
  expect(artifact).toContain('SceneCraftStandalone.mount');
  expect(artifact).toContain('const spec=');
  expect(artifact).not.toMatch(/<script\s+src=/i);
  await page.goto('/projects');
  await page.getByRole('heading', { name: 'Projects', exact: true }).waitFor();
  await page.locator('.project-card details summary').click();
  page.once('dialog', (dialog) => void dialog.accept());
  await page
    .getByRole('combobox', { name: 'Restore revision of E2E saved scene' })
    .selectOption('0');
  await expect(
    page.getByRole('status').filter({ hasText: 'restored as a new revision' }),
  ).toBeVisible();

  for (const section of ['Projects', 'Assets', 'AI Models']) {
    if (section === 'AI Models') {
      await page
        .getByRole('navigation')
        .getByRole('link', { name: section, exact: true })
        .click();
    } else {
      await page.goto(`/${section.toLowerCase()}`);
    }
    await expect(
      page.getByRole('heading', { name: section, exact: true }),
    ).toBeVisible();
    if (section === 'AI Models') {
      await expect(
        page.getByRole('button', { name: 'Add connection' }),
      ).toBeDisabled();
      await expect(page.locator('input[type="password"]')).toHaveCount(1);
    }
  }
  await page
    .getByRole('navigation')
    .getByRole('link', { name: 'Settings', exact: true })
    .click();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();

  await page
    .getByRole('combobox', { name: 'Appearance' })
    .selectOption('light');
  await page.reload();
  await expect(page.getByRole('combobox', { name: 'Appearance' })).toHaveValue(
    'light',
  );
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
