import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PlaywrightHealerAgent } from '../src/services/healer-agent.js';
import { FileStore } from '../src/storage/file-store.js';

describe('PlaywrightHealerAgent (§3.6)', { timeout: 30000 }, () => {
  let tmpDir: string;
  let store: FileStore;
  let healer: PlaywrightHealerAgent;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'qaa-healer-'));
    store = new FileStore({
      rootDir: tmpDir,
      specsDir: path.join(tmpDir, 'specs'),
      automationDir: path.join(tmpDir, 'automation'),
      reportsDir: path.join(tmpDir, 'reports'),
      tempWorkspaceDir: path.join(tmpDir, '.workspace'),
    });
    await store.init();
    healer = new PlaywrightHealerAgent(store);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('does nothing if tests are already passing', async () => {
    await store.writeWorkspaceFile(
      'web/pages/LoginPage.ts',
      `import { type Page } from '@playwright/test';
export class LoginPage {
  constructor(page: Page) {
    page.getByRole('button', { name: /login/i });
  }
}
`,
    );

    await store.writeWorkspaceFile(
      'web/tests/SPEC-001/SPEC-001-TC-001.spec.ts',
      `import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages/LoginPage';
// Spec ID: SPEC-001
// Test Case ID: TC-001
test('TC-001: Valid login', async ({ page }) => {
  const p = new LoginPage(page);
  expect(p).toBeDefined();
});
`,
    );

    const result = await healer.heal({
      specId: 'SPEC-001',
      approvedTestCaseIds: ['TC-001'],
      dynamicMode: 'simulated',
    });

    expect(result.successful).toBe(true);
    expect(result.summary.attempted).toBe(false);
    expect(result.summary.totalAttempts).toBe(0);
  });

  it('heals broken selectors with bounded retries (§3.6)', async () => {
    await store.writeWorkspaceFile(
      'web/pages/LoginPage.ts',
      `import { type Page, type Locator } from '@playwright/test';
export class LoginPage {
  readonly button: Locator;
  constructor(page: Page) {
    this.button = page.getByPlaceholder('invalid-broken-selector');
  }
}
`,
    );

    await store.writeWorkspaceFile(
      'web/tests/SPEC-001/SPEC-001-TC-001.spec.ts',
      `import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages/LoginPage';
// Spec ID: SPEC-001
// Test Case ID: TC-001
test('TC-001: Broken selector test', async ({ page }) => {
  const p = new LoginPage(page);
  await page.locator('invalid-broken-selector').click();
  expect(p).toBeDefined();
});
`,
    );

    const result = await healer.heal({
      specId: 'SPEC-001',
      approvedTestCaseIds: ['TC-001'],
      maxAttempts: 3,
      dynamicMode: 'simulated',
    });

    expect(result.successful).toBe(true);
    expect(result.summary.attempted).toBe(true);
    expect(result.summary.successful).toBe(true);
    expect(result.summary.totalAttempts).toBeGreaterThanOrEqual(1);
    expect(result.summary.attempts[0]?.changesApplied.length).toBeGreaterThan(0);

    // Verify workspace file was healed
    const healedContent = await store.readWorkspaceFile(
      'web/tests/SPEC-001/SPEC-001-TC-001.spec.ts',
    );
    expect(healedContent).not.toContain('invalid-broken-selector');
  });

  it('heals prohibited debugger statements', async () => {
    await store.writeWorkspaceFile(
      'web/tests/SPEC-001/SPEC-001-TC-001.spec.ts',
      `import { test, expect } from '@playwright/test';
// Spec ID: SPEC-001
// Test Case ID: TC-001
test('TC-001: Test with debugger', async ({ page }) => {
  debugger;
  expect(true).toBe(true);
});
`,
    );

    const result = await healer.heal({
      specId: 'SPEC-001',
      approvedTestCaseIds: ['TC-001'],
      maxAttempts: 2,
      dynamicMode: 'simulated',
    });

    expect(result.successful).toBe(true);
    expect(
      result.summary.attempts.some((a) =>
        a.changesApplied.some((c) => c.description.includes('debugger')),
      ),
    ).toBe(true);

    const healedContent = await store.readWorkspaceFile(
      'web/tests/SPEC-001/SPEC-001-TC-001.spec.ts',
    );
    expect(healedContent).not.toContain('debugger;');
  });

  it('stops and marks as failed when maxAttempts are exhausted', async () => {
    // Unhealable syntax garbage that heuristic cannot resolve
    await store.writeWorkspaceFile('web/pages/Hopeless.ts', `const !@#$%^&*()_+= garbage;`);

    const result = await healer.heal({
      specId: 'SPEC-001',
      approvedTestCaseIds: ['TC-001'],
      maxAttempts: 2,
      dynamicMode: 'simulated',
    });

    expect(result.successful).toBe(false);
    expect(result.summary.successful).toBe(false);
    expect(result.summary.totalAttempts).toBe(2);
    expect(result.summary.maxAttempts).toBe(2);
  });
});
