import { test, expect } from '@playwright/test';

// Patch 2.5.3: the toolbar's cryptic icons carry a visible caption, and no toolbar button is ever pushed off the canvas.

const CAPTIONS = [
  ['Select all devices', 'Select all'],
  ['Assign IP addresses', 'Assign IP'],
  ['Delete selection', 'Delete'],
  ['Clear the canvas', 'Clear'],
  ['Library', 'Library'],
  ['Hide panel', 'Hide panel'],
];

/** The names of toolbar buttons that stick out past the left or right edge of the canvas. */
async function buttonsOutsideCanvas(page) {
  const canvas = await page.getByRole('group', { name: 'Network canvas' }).boundingBox();
  const outside = [];
  for (const bar of ['Tools', 'Actions']) {
    for (const button of await page.getByRole('toolbar', { name: bar }).getByRole('button').all()) {
      const box = await button.boundingBox();
      const name = (await button.getAttribute('aria-label')) ?? (await button.innerText());
      if (!box || box.x < canvas.x - 0.5 || box.x + box.width > canvas.x + canvas.width + 0.5) outside.push(name);
    }
  }
  return outside;
}

test.beforeEach(async ({ page }) => {
  await page.goto('/sandbox');
  await expect(page.locator('[data-ready="true"]')).toBeVisible();
});

test('the action buttons show a text label, not just an icon', async ({ page }) => {
  for (const [name, caption] of CAPTIONS) {
    await expect(page.getByRole('button', { name, exact: true })).toContainText(caption);
  }
});

test('the panel button changes its label when the panel is hidden', async ({ page }) => {
  await page.getByRole('button', { name: 'Hide panel', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Show panel', exact: true })).toContainText('Show panel');
  await page.getByRole('button', { name: 'Show panel', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Hide panel', exact: true })).toBeVisible();
});

for (const [width, height] of [[1280, 800], [412, 915], [390, 844], [360, 780]]) {
  test(`no toolbar button is cut off at ${width}px wide`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await expect.poll(() => buttonsOutsideCanvas(page)).toEqual([]);
  });
}

test('Undo and Redo can be used on a 390px phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Add PC' }).click();
  const pc = page.getByRole('button', { name: /^PC 1/ });
  await expect(pc).toBeVisible();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(pc).toHaveCount(0);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(pc).toBeVisible();
});
