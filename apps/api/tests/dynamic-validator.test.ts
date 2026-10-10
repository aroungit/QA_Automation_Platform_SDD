import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DynamicValidator } from '../src/services/dynamic-validator.js';
import { FileStore } from '../src/storage/file-store.js';

describe('DynamicValidator (§3.6)', () => {
  let tmpDir: string;
  let store: FileStore;
  let validator: DynamicValidator;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'qaa-dyn-val-'));
    store = new FileStore({
      rootDir: tmpDir,
      specsDir: path.join(tmpDir, 'specs'),
      automationDir: path.join(tmpDir, 'automation'),
      reportsDir: path.join(tmpDir, 'reports'),
      tempWorkspaceDir: path.join(tmpDir, '.workspace'),
    });
    await store.init();
    validator = new DynamicValidator(store);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('fails if no test files exist for spec in workspace', async () => {
    const result = await validator.validate({
      specId: 'SPEC-LOGIN-001',
      mode: 'simulated',
    });

    expect(result.passed).toBe(false);
    expect(result.executed).toBe(false);
    expect(result.error).toContain('No test files found in workspace');
  });

  it('executes simulated validation and records test case results, duration, and logs', async () => {
    await store.writeWorkspaceFile(
      'web/fixtures/auth-data.json',
      JSON.stringify({ validUser: 'Admin' }, null, 2),
    );

    await store.writeWorkspaceFile(
      'web/tests/SPEC-LOGIN-001/SPEC-LOGIN-001-TC-001.spec.ts',
      `import { test, expect } from '@playwright/test';
// Spec ID: SPEC-LOGIN-001
// Test Case ID: TC-LOGIN-001
test('TC-LOGIN-001: Valid login', async ({ page }) => {
  await page.goto('/login');
  expect(true).toBe(true);
});
`,
    );

    await store.writeWorkspaceFile(
      'web/tests/SPEC-LOGIN-001/SPEC-LOGIN-001-TC-002.spec.ts',
      `import { test, expect } from '@playwright/test';
// Spec ID: SPEC-LOGIN-001
// Test Case ID: TC-LOGIN-002
test('TC-LOGIN-002: Invalid login', async ({ page }) => {
  await page.goto('/login');
  expect(true).toBe(true);
});
`,
    );

    const result = await validator.validate({
      specId: 'SPEC-LOGIN-001',
      mode: 'simulated',
    });

    expect(result.passed).toBe(true);
    expect(result.executed).toBe(true);
    expect(result.totalTests).toBe(2);
    expect(result.passedCount).toBe(2);
    expect(result.failedCount).toBe(0);
    expect(result.tests.map((t) => t.testCaseId)).toEqual(['TC-LOGIN-001', 'TC-LOGIN-002']);
    expect(result.tests[0]?.consoleLogs?.length).toBeGreaterThan(0);
  });

  it('detects simulated failures and captures screenshots and traces (§3.6)', async () => {
    await store.writeWorkspaceFile(
      'web/tests/SPEC-LOGIN-001/SPEC-LOGIN-001-TC-001.spec.ts',
      `import { test, expect } from '@playwright/test';
// Spec ID: SPEC-LOGIN-001
// Test Case ID: TC-LOGIN-001
test('TC-LOGIN-001: Failing test with invalid selector', async ({ page }) => {
  await page.locator('invalid-broken-selector').click();
});
`,
    );

    const result = await validator.validate({
      specId: 'SPEC-LOGIN-001',
      mode: 'simulated',
    });

    expect(result.passed).toBe(false);
    expect(result.failedCount).toBe(1);
    expect(result.tests[0]?.status).toBe('failed');
    expect(result.tests[0]?.error).toContain('invalid-broken-selector');
    expect(result.tests[0]?.screenshotUrl).toBeDefined();
    expect(result.tests[0]?.traceUrl).toBeDefined();
    expect(result.artifacts.screenshots.length).toBeGreaterThan(0);
    expect(result.artifacts.traces.length).toBeGreaterThan(0);
  });

  it('handles real mode error gracefully when test target is missing or fails', async () => {
    // In an empty workspace without playwright installed in temp directory
    const result = await validator.validate({
      specId: 'SPEC-NONEXISTENT',
      mode: 'real',
      timeoutMs: 3000,
    });

    expect(result.passed).toBe(false);
    expect(result.executed).toBe(false);
    expect(result.error).toBeDefined();
  });
});
