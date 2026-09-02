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

// Seeding a named player is what skips onboarding. A cold install has no name,
// so "/" routes to the name prompt instead of the tabs — every spec below wants
// the app past that point, so the seed writes the name first and then enters
// through "/" again. It navigates rather than reloading because the first goto
// lands on /onboarding/name, and reloading there would re-test the redirect
// instead of getting on with the workout.
async function seed(page: Page) {
  await page.setViewportSize(MOBILE_VIEWPORT);
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  await page.evaluate((state) => {
    localStorage.setItem('player.full_state', JSON.stringify(state.player));
  }, INITIAL_STATE);

  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);
}

// The first screen anybody who isn't Adrian will ever see. It's also the only
// thing standing between a new install and a profile labelled with nothing, so
// it gets covered on the real static export rather than trusted to unit tests.
test.describe('Onboarding', () => {
  test('a cold install is asked for a name before anything else', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    await expect(page.getByText('What should we call you?')).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('tab', { name: 'Workouts' })).toHaveCount(0);
  });

  test('the name is kept, and the prompt does not come back', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    await page.getByPlaceholder('Your name').fill('Marcus');
    await page.getByText('Start training').click();
    await page.waitForTimeout(2000);

    await expect(page.getByRole('tab', { name: 'Workouts' })).toBeVisible({ timeout: 10000 });

    const stored = await page.evaluate(
      () => JSON.parse(localStorage.getItem('player.full_state') ?? '{}').profile?.name
    );
    expect(stored).toBe('Marcus');

    // A returning user must land in the app, not back on the prompt.
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    await expect(page.getByRole('tab', { name: 'Workouts' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('What should we call you?')).toHaveCount(0);
  });

  // Landing on the route directly with a name already set must not re-prompt —
  // a reload, a bookmark, or a restored tab can all put you here.
  test('deep-linking to the prompt with a name set redirects into the app', async ({ page }) => {
    await seed(page);

    await page.goto('/onboarding/name');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    await expect(page.getByRole('tab', { name: 'Workouts' })).toBeVisible({ timeout: 10000 });
  });
});

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

test.describe('Session teardown', () => {
  test.beforeEach(({ page }) => seed(page));

  // Regression: ending a session emptied the workout store while the session
  // screen was still mounted. The screen's "No active workout" guard sits below
  // two weight-history selectors that dereference `currentExercise.id`, so the
  // selectors threw before the guard could run and React unmounted the whole
  // tree — a white screen, not a fallback.
  test('ending a workout early does not blank the app', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await page.getByText('Full Body').first().click();
    await page.waitForTimeout(1000);
    await page
      .getByText(/Review Day A & Start/)
      .first()
      .click();
    await page.waitForTimeout(1200);
    await page
      .getByText(/^Start Day \w+ Workout$/i)
      .first()
      .click();
    await page.waitForTimeout(1500);

    const endButton = page.getByText(/^End$/).first();
    await expect(endButton).toBeVisible({ timeout: 10000 });

    await endButton.click();
    await page.waitForTimeout(2000);

    const text = ((await page.locator('body').innerText()) || '').trim();
    expect(text.length, 'app rendered a white screen after ending the session').toBeGreaterThan(0);
    expect(errors, 'uncaught render errors after ending the session').toEqual([]);
  });
});

test.describe('Profile', () => {
  test.beforeEach(({ page }) => seed(page));

  test('no longer offers a dev panel', async ({ page }) => {
    await page.getByRole('tab', { name: 'Profile' }).click();
    await page.waitForTimeout(800);

    await expect(page.getByText('Dev Panel')).toHaveCount(0);
    await expect(page.getByText('Developer')).toHaveCount(0);
  });

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
