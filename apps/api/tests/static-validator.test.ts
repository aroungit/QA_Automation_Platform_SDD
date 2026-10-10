import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { StaticValidator } from '../src/services/static-validator.js';
import { FileStore } from '../src/storage/file-store.js';

describe('StaticValidator (§3.6)', { timeout: 30000 }, () => {
  let tmpDir: string;
  let store: FileStore;
  let validator: StaticValidator;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'qaa-static-val-'));
    store = new FileStore({
      rootDir: tmpDir,
      specsDir: path.join(tmpDir, 'specs'),
      automationDir: path.join(tmpDir, 'automation'),
      reportsDir: path.join(tmpDir, 'reports'),
      tempWorkspaceDir: path.join(tmpDir, '.workspace'),
    });
    await store.init();
    validator = new StaticValidator(store);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('fails if no TypeScript files exist in workspace', async () => {
    const result = await validator.validate();
    expect(result.passed).toBe(false);
    expect(result.typeScriptCheck.errors[0]).toContain('No TypeScript files found');
  });

  it('passes on valid TypeScript Page Objects and test files with stable selectors', async () => {
    // 1. Page object
    await store.writeWorkspaceFile(
      'web/pages/LoginPage.ts',
      `import { type Page, type Locator } from '@playwright/test';

export class LoginPage {
  readonly page: Page;
  readonly usernameInput: Locator;
  readonly loginButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.usernameInput = page.getByPlaceholder('Username');
    this.loginButton = page.getByRole('button', { name: /login/i });
  }

  async goto(): Promise<void> {
    await this.page.goto('/login');
  }
}
`,
    );

    // 2. Fixture
    await store.writeWorkspaceFile(
      'web/fixtures/auth.json',
      JSON.stringify({ user: 'Admin' }, null, 2),
    );

    // 3. Test file
    await store.writeWorkspaceFile(
      'web/tests/SPEC-001/SPEC-001-TC-001.spec.ts',
      `import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages/LoginPage';
import auth from '../../fixtures/auth.json';

// Spec ID: SPEC-001
// Test Case ID: TC-001
test('TC-001: Valid login', async ({ page }) => {
  const loginPage = new LoginPage(page);
  await loginPage.goto();
  expect(loginPage).toBeDefined();
});
`,
    );

    const result = await validator.validate();
    expect(result.passed).toBe(true);
    expect(result.typeScriptCheck.passed).toBe(true);
    expect(result.lintCheck.passed).toBe(true);
    expect(result.selectorValidation.passed).toBe(true);
    expect(result.selectorValidation.validCount).toBeGreaterThanOrEqual(2);
    expect(result.importValidation.passed).toBe(true);
  });

  it('detects syntax and TypeScript compiler errors', async () => {
    await store.writeWorkspaceFile(
      'web/pages/BrokenPage.ts',
      `import { type Page } from '@playwright/test';

export class BrokenPage {
  this is completely invalid typescript syntax;
}
`,
    );

    const result = await validator.validate();
    expect(result.passed).toBe(false);
    expect(result.typeScriptCheck.passed).toBe(false);
    expect(result.typeScriptCheck.errors.length).toBeGreaterThan(0);
  });

  it('detects unresolvable relative imports (§3.6)', async () => {
    await store.writeWorkspaceFile(
      'web/tests/SPEC-001/test.spec.ts',
      `import { test, expect } from '@playwright/test';
import { NonExistentPage } from '../../pages/NonExistentPage';

test('sample', async () => {
  expect(true).toBe(true);
});
`,
    );

    const result = await validator.validate();
    expect(result.passed).toBe(false);
    expect(result.importValidation.passed).toBe(false);
    expect(result.importValidation.errors.some((e) => e.includes('NonExistentPage'))).toBe(true);
  });

  it('detects disallowed external package imports (§3.6)', async () => {
    await store.writeWorkspaceFile(
      'web/pages/HackPage.ts',
      `import { malicious } from 'malicious-unverified-package';

export class HackPage {}
`,
    );

    const result = await validator.validate();
    expect(result.passed).toBe(false);
    expect(result.importValidation.passed).toBe(false);
    expect(
      result.importValidation.errors.some((e) => e.includes('malicious-unverified-package')),
    ).toBe(true);
  });

  it('detects brittle locators such as absolute XPath or deep CSS chains (§3.5, §3.6)', async () => {
    await store.writeWorkspaceFile(
      'web/pages/BrittlePage.ts',
      `import { type Page, type Locator } from '@playwright/test';

export class BrittlePage {
  readonly brittleXPath: Locator;
  readonly deepCss: Locator;

  constructor(page: Page) {
    this.brittleXPath = page.locator('//html/body/div[1]/form/input');
    this.deepCss = page.locator('div > div > div > span:nth-child(2)');
  }
}
`,
    );

    const result = await validator.validate();
    expect(result.passed).toBe(false);
    expect(result.selectorValidation.passed).toBe(false);
    expect(result.selectorValidation.warnings.length).toBeGreaterThanOrEqual(2);
  });

  it('detects prohibited debugger statements and warns on arbitrary timeouts', async () => {
    await store.writeWorkspaceFile(
      'web/tests/SPEC-001/test.spec.ts',
      `import { test, expect } from '@playwright/test';

test('sample', async ({ page }) => {
  debugger;
  await page.waitForTimeout(5000);
  expect(true).toBe(true);
});
`,
    );

    const result = await validator.validate();
    expect(result.passed).toBe(false);
    expect(result.lintCheck.passed).toBe(false);
    expect(result.lintCheck.errors.some((e) => e.includes('debugger'))).toBe(true);
    expect(result.lintCheck.warnings.some((w) => w.includes('waitForTimeout'))).toBe(true);
  });
});
