// =============================================================================
// Embr E2E — golden paths
// =============================================================================
// Run with: npm run test:e2e
//
// This file used to be five describe blocks of empty stubs — tests whose bodies
// were comments describing what they *would* do, with no assertions. Those pass
// vacuously, which is worse than not existing: a green suite that checks
// nothing. They're gone. What's left actually asserts.
//
// It also seeded a pet into localStorage before every test. The pet is gone
// (ADR-0014), and so are the fp-system / pet-care / stat-persistence specs that
// existed only to exercise it.
// =============================================================================

import { type Page, expect, test } from '@playwright/test';

const MOBILE_VIEWPORT = { width: 390, height: 844 };

const INITIAL_STATE = {
  player: {
    profile: { name: 'Test User', avatar: null, createdAt: new Date().toISOString() },
    fp: { generic: 0, power: 0, guard: 0, speed: 0, vigor: 0, focus: 0, spirit: 0 },
    streak: { current: 1, longest: 1, lastWorkoutDate: new Date().toISOString().split('T')[0] },
    achievements: [],
    totalWorkouts: 1,
  },
};

async function seed(page: Page) {
  await page.setViewportSize(MOBILE_VIEWPORT);
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  await page.evaluate((state) => {
    localStorage.setItem('player.full_state', JSON.stringify(state.player));
  }, INITIAL_STATE);

  await page.reload();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);
}

test.describe('Home', () => {
  test.beforeEach(({ page }) => seed(page));

  test('shows the two tracker tabs and no game-layer tabs', async ({ page }) => {
    await expect(page.getByRole('tab', { name: 'Workouts' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('tab', { name: 'Profile' })).toBeVisible();

    // Regression guard for ADR-0014: these must never come back by accident.
    await expect(page.getByRole('tab', { name: 'The Den' })).toHaveCount(0);
    await expect(page.getByRole('tab', { name: 'Tower' })).toHaveCount(0);
    await expect(page.getByRole('tab', { name: 'Quest Board' })).toHaveCount(0);
  });

  test('lists workout templates', async ({ page }) => {
    await expect(page.getByText('Workout Templates')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Full Body').first()).toBeVisible({ timeout: 5000 });
  });

  test('shows the streak hero and quick stats', async ({ page }) => {
    await expect(page.getByText('day streak')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Quick Stats')).toBeVisible();
  });
});

test.describe('Template → workout', () => {
  test.beforeEach(({ page }) => seed(page));

  test('opens a template and reaches the session picker', async ({ page }) => {
    await page.getByText('Full Body').first().click();
    await page.waitForTimeout(800);

    await expect(page.getByText('Select Session')).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Profile', () => {
  test.beforeEach(({ page }) => seed(page));

  test('exposes the backup controls — the only defense against storage eviction', async ({
    page,
  }) => {
    await page.getByRole('tab', { name: 'Profile' }).click();
    await page.waitForTimeout(800);

    await expect(page.getByText('Export backup')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Restore from backup')).toBeVisible();
  });

  test('names itself Embr', async ({ page }) => {
    await page.getByRole('tab', { name: 'Profile' }).click();
    await page.waitForTimeout(800);

    await expect(page.getByText('Embr').first()).toBeVisible({ timeout: 10000 });
  });
});
