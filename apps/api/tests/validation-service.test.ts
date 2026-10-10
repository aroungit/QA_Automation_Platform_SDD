import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ApprovalService } from '../src/services/approval-service.js';
import { IntakeService } from '../src/services/intake-service.js';
import { ScriptGenerator } from '../src/services/script-generator.js';
import { ValidationService } from '../src/services/validation-service.js';
import { FileStore } from '../src/storage/file-store.js';

describe('ValidationService (§3.6, §3.7, §8)', { timeout: 30000 }, () => {
  let tmpDir: string;
  let store: FileStore;
  let intakeService: IntakeService;
  let approvalService: ApprovalService;
  let scriptGenerator: ScriptGenerator;
  let validationService: ValidationService;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'qaa-val-service-'));
    store = new FileStore({
      rootDir: tmpDir,
      specsDir: path.join(tmpDir, 'specs'),
      automationDir: path.join(tmpDir, 'automation'),
      reportsDir: path.join(tmpDir, 'reports'),
      tempWorkspaceDir: path.join(tmpDir, '.workspace'),
    });
    await store.init();
    intakeService = new IntakeService(store);
    approvalService = intakeService.getApprovalService();
    scriptGenerator = new ScriptGenerator(store);
    validationService = new ValidationService(store);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  async function createApprovedSpecWithScripts() {
    const intake = await intakeService.processIntake({
      title: 'Admin User Login',
      story: 'As an admin, I want to log in so that I can access the admin dashboard.',
      acceptanceCriteria: [
        'Valid credentials redirect to dashboard',
        'Invalid credentials show error',
      ],
      priority: 'high',
      platform: 'web',
      targetApp: 'OrangeHRM',
      generateSpec: true,
      generateTestCases: true,
    });

    const specId = intake.specId;

    // Approve the spec (§3.4)
    await approvalService.submitDecision(specId, {
      status: 'Approved',
      reviewer: 'QA Lead',
      comments: 'All test cases verified and approved for automation (§3.4)',
    });

    // Generate scripts into .workspace (§3.5)
    await scriptGenerator.generate(specId);

    return specId;
  }

  it('rejects validation when specification is not in Approved status (§3.4, §3.6)', async () => {
    const intake = await intakeService.processIntake({
      title: 'Unapproved Spec',
      story: 'As a user I want to log in',
      acceptanceCriteria: ['Login works'],
      priority: 'medium',
      platform: 'web',
      targetApp: 'OrangeHRM',
      generateSpec: true,
      generateTestCases: true,
    });

    await expect(
      validationService.validate(intake.specId, { executionMode: 'simulated' }),
    ).rejects.toThrow(/Approved/);
  });

  it('rejects validation when workspace has no generated scripts for spec', async () => {
    const intake = await intakeService.processIntake({
      title: 'Approved But No Scripts',
      story: 'As a user I want to log in',
      acceptanceCriteria: ['Login works'],
      priority: 'medium',
      platform: 'web',
      targetApp: 'OrangeHRM',
      generateSpec: true,
      generateTestCases: true,
    });

    await approvalService.submitDecision(intake.specId, {
      status: 'Approved',
      reviewer: 'Lead',
      comments: 'Approved',
    });

    await expect(
      validationService.validate(intake.specId, { executionMode: 'simulated' }),
    ).rejects.toThrow(/No generated scripts found in workspace/);
  });

  it('executes full validation pipeline and produces passing ValidationReport (§3.6, §3.7)', async () => {
    const specId = await createApprovedSpecWithScripts();

    const report = await validationService.validate(specId, {
      executionMode: 'simulated',
      autoHeal: false,
    });

    expect(report.specId).toBe(specId);
    expect(report.reportId).toMatch(/^VAL-/);
    expect(report.overallStatus).toBe('PASSED');
    expect(report.eligibleForPromotion).toBe(true);
    expect(report.staticValidation.passed).toBe(true);
    expect(report.dynamicValidation.passed).toBe(true);
    expect(report.dynamicValidation.totalTests).toBeGreaterThanOrEqual(1);
    expect(report.conformanceCheck.passed).toBe(true);
    expect(report.conformanceCheck.missing).toEqual([]);

    // Verify report was persisted to reports/execution-results
    const saved = await validationService.getReport(report.reportId);
    expect(saved).not.toBeNull();
    expect(saved?.reportId).toBe(report.reportId);
    expect(saved?.overallStatus).toBe('PASSED');
  });

  it('triggers auto-healing when a test has a broken selector and achieves HEALED_PASSED (§3.6)', async () => {
    const specId = await createApprovedSpecWithScripts();

    // Intentionally inject a broken selector into one of the test files in workspace
    const wsFiles = await store.listWorkspaceFiles();
    const testFile = wsFiles.find((f) => f.includes('/tests/') && f.endsWith('.spec.ts'));
    expect(testFile).toBeDefined();

    const originalContent = await store.readWorkspaceFile(testFile!);
    await store.writeWorkspaceFile(
      testFile!,
      originalContent!.replace(
        'new LoginPage(page)',
        "new LoginPage(page);\n  await page.locator('invalid-broken-selector').click();",
      ),
    );

    const report = await validationService.validate(specId, {
      executionMode: 'simulated',
      autoHeal: true,
      maxHealAttempts: 3,
    });

    expect(report.overallStatus).toBe('HEALED_PASSED');
    expect(report.eligibleForPromotion).toBe(true);
    expect(report.healingSummary).toBeDefined();
    expect(report.healingSummary?.attempted).toBe(true);
    expect(report.healingSummary?.successful).toBe(true);
  });

  it('lists reports and retrieves the latest validation report for a spec (§3.7)', async () => {
    const specId = await createApprovedSpecWithScripts();

    await validationService.validate(specId, { executionMode: 'simulated' });
    const report2 = await validationService.validate(specId, { executionMode: 'simulated' });

    const allReports = await validationService.listReports(specId);
    expect(allReports.length).toBe(2);

    const latest = await validationService.getLatestReport(specId);
    expect(latest?.reportId).toBe(report2.reportId);
  });
});
