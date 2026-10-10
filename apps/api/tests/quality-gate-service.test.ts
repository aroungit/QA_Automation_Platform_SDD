import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ValidationReport } from '@qaa/shared';
import { ApprovalService } from '../src/services/approval-service.js';
import { IntakeService } from '../src/services/intake-service.js';
import { QualityGateError, QualityGateService } from '../src/services/quality-gate-service.js';
import { ScriptGenerator } from '../src/services/script-generator.js';
import { ValidationService } from '../src/services/validation-service.js';
import { FileStore } from '../src/storage/file-store.js';

describe('QualityGateService (§8)', { timeout: 30000 }, () => {
  let tmpDir: string;
  let store: FileStore;
  let intakeService: IntakeService;
  let approvalService: ApprovalService;
  let scriptGenerator: ScriptGenerator;
  let validationService: ValidationService;
  let qualityGateService: QualityGateService;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'qaa-quality-gate-'));
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
    qualityGateService = new QualityGateService(store, validationService);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  async function createSpecWithApprovedScripts(executionMode: 'simulated' | 'real' = 'simulated') {
    const intake = await intakeService.processIntake({
      title: 'User Authentication Flow',
      story: 'As a user, I want to log in with valid credentials so that I can view my dashboard.',
      acceptanceCriteria: ['Valid login redirects to dashboard', 'Invalid login displays error'],
      priority: 'high',
      platform: 'web',
      targetApp: 'OrangeHRM',
      generateSpec: true,
      generateTestCases: true,
    });

    const specId = intake.specId;

    await approvalService.submitDecision(specId, {
      status: 'Approved',
      reviewer: 'QA Lead',
      comments: 'Approved for automation (§3.4)',
    });

    await scriptGenerator.generate(specId);

    const report = await validationService.validate(specId, {
      autoHeal: false,
      executionMode,
    });

    return { specId, report };
  }

  it('evaluates all 8 Quality Gates (§8) and reports each gate individually', async () => {
    const { specId, report } = await createSpecWithApprovedScripts('simulated');
    expect(report.overallStatus).toBe('PASSED');

    const evaluation = await qualityGateService.evaluate(specId);

    expect(evaluation.specId).toBe(specId);
    expect(evaluation.gates).toHaveLength(8);

    const gateKeys = evaluation.gates.map((g) => g.gate);
    expect(gateKeys).toEqual([
      'APPROVED_SPECIFICATION',
      'APPROVED_TEST_CASES',
      'SCRIPTS_MAP_TO_APPROVED_TEST_CASES',
      'SCRIPTS_COMPILE_SUCCESSFULLY',
      'SCRIPTS_PASS_AUTOMATED_EXECUTION',
      'EXECUTION_EVIDENCE_STORED',
      'NO_UNAPPROVED_FUNCTIONALITY_AUTOMATED',
      'SPEC_UP_TO_DATE_NO_REVALIDATION_REQUIRED',
    ]);

    expect(evaluation.passed).toBe(true);
    expect(evaluation.status).toBe('PASSED');
    expect(evaluation.revalidationRequired).toBe(false);
  });

  it('Gate 1 fails when specification is in Draft status (§3.4, §8)', async () => {
    const intake = await intakeService.processIntake({
      title: 'Draft User Story',
      story: 'As a user, I want to reset my password.',
      acceptanceCriteria: ['Reset link sent via email'],
      priority: 'medium',
      generateSpec: true,
      generateTestCases: true,
    });

    const specId = intake.specId;
    const evaluation = await qualityGateService.evaluate(specId);

    const gate1 = evaluation.gates.find((g) => g.gate === 'APPROVED_SPECIFICATION');
    expect(gate1?.passed).toBe(false);
    expect(gate1?.details).toContain('Draft');
    expect(evaluation.passed).toBe(false);
  });

  it('Gate 2 fails when specification is Approved but has no approved test cases (§3.4, §8)', async () => {
    const intake = await intakeService.processIntake({
      title: 'Empty Approval Spec',
      story: 'As a user, I want to edit profile.',
      acceptanceCriteria: ['Profile updated successfully'],
      priority: 'medium',
      generateSpec: true,
      generateTestCases: true,
    });

    const specId = intake.specId;
    // Save approval record with Approved status but empty approved test cases
    await store.saveSpecArtifacts(specId, {
      approvalRecord: {
        specId,
        status: 'Approved',
        reviewer: 'Admin',
        comments: 'No cases selected',
        approvedTestCases: [],
        timestamp: new Date().toISOString(),
      },
    });

    const evaluation = await qualityGateService.evaluate(specId);
    const gate2 = evaluation.gates.find((g) => g.gate === 'APPROVED_TEST_CASES');
    expect(gate2?.passed).toBe(false);
    expect(gate2?.details).toContain('No approved test cases found');
  });

  it('Gate 3 fails when approved test cases are missing from validation report (§3.6, §8)', async () => {
    const { specId, report } = await createSpecWithApprovedScripts('simulated');

    // Create a modified validation report with missing test case
    const tamperedReport: ValidationReport = {
      ...report,
      reportId: `VAL-${specId}-tamper-${Date.now()}`,
      timestamp: new Date(Date.now() + 1000).toISOString(),
      conformanceCheck: {
        ...report.conformanceCheck,
        passed: false,
        missing: ['TC-MISSING-001'],
      },
    };
    await store.saveExecutionReport(tamperedReport.reportId, tamperedReport);

    const evaluation = await qualityGateService.evaluate(specId);
    const gate3 = evaluation.gates.find((g) => g.gate === 'SCRIPTS_MAP_TO_APPROVED_TEST_CASES');
    expect(gate3?.passed).toBe(false);
    expect(gate3?.details).toContain('Missing test scripts');
  });

  it('Gate 4 fails when static TypeScript compilation fails (§3.6, §8)', async () => {
    const { specId, report } = await createSpecWithApprovedScripts('simulated');

    const failingReport: ValidationReport = {
      ...report,
      reportId: `VAL-${specId}-static-fail-${Date.now()}`,
      timestamp: new Date(Date.now() + 1000).toISOString(),
      staticValidation: {
        ...report.staticValidation,
        passed: false,
        typeScriptCheck: {
          passed: false,
          errors: ['LoginPage.ts(12,5): error TS2304: Cannot find name "invalidLocator".'],
        },
      },
    };
    await store.saveExecutionReport(failingReport.reportId, failingReport);

    const evaluation = await qualityGateService.evaluate(specId);
    const gate4 = evaluation.gates.find((g) => g.gate === 'SCRIPTS_COMPILE_SUCCESSFULLY');
    expect(gate4?.passed).toBe(false);
    expect(gate4?.details).toContain('Static validation failed');
  });

  it('Gate 5 fails when dynamic validation tests fail execution (§3.6, §8)', async () => {
    const { specId, report } = await createSpecWithApprovedScripts('simulated');

    const failingReport: ValidationReport = {
      ...report,
      reportId: `VAL-${specId}-dyn-fail-${Date.now()}`,
      timestamp: new Date(Date.now() + 1000).toISOString(),
      overallStatus: 'FAILED',
      dynamicValidation: {
        ...report.dynamicValidation,
        passed: false,
        failedCount: 1,
        passedCount: 0,
      },
    };
    await store.saveExecutionReport(failingReport.reportId, failingReport);

    const evaluation = await qualityGateService.evaluate(specId);
    const gate5 = evaluation.gates.find((g) => g.gate === 'SCRIPTS_PASS_AUTOMATED_EXECUTION');
    expect(gate5?.passed).toBe(false);
    expect(gate5?.details).toContain('failed execution');
  });

  it('Gate 6 fails when execution report is not found in reports store (§3.7, §8)', async () => {
    const intake = await intakeService.processIntake({
      title: 'Spec With No Evidence',
      story: 'Story without validation evidence',
      acceptanceCriteria: ['Valid criteria'],
      priority: 'low',
      generateSpec: true,
      generateTestCases: true,
    });

    const specId = intake.specId;
    await approvalService.submitDecision(specId, {
      status: 'Approved',
      reviewer: 'Lead',
      comments: 'Approved',
    });

    const evaluation = await qualityGateService.evaluate(specId);
    const gate6 = evaluation.gates.find((g) => g.gate === 'EXECUTION_EVIDENCE_STORED');
    expect(gate6?.passed).toBe(false);
    expect(gate6?.details).toContain('not found in reports/execution-results');
  });

  it('Gate 7 fails when unapproved functionality is detected (§3.6, §8)', async () => {
    const { specId, report } = await createSpecWithApprovedScripts('simulated');

    const unapprovedReport: ValidationReport = {
      ...report,
      reportId: `VAL-${specId}-unapproved-${Date.now()}`,
      timestamp: new Date(Date.now() + 1000).toISOString(),
      conformanceCheck: {
        ...report.conformanceCheck,
        unmapped: ['TC-ROGUE-999'],
      },
    };
    await store.saveExecutionReport(unapprovedReport.reportId, unapprovedReport);

    const evaluation = await qualityGateService.evaluate(specId);
    const gate7 = evaluation.gates.find((g) => g.gate === 'NO_UNAPPROVED_FUNCTIONALITY_AUTOMATED');
    expect(gate7?.passed).toBe(false);
    expect(gate7?.details).toContain('Unapproved test cases detected: TC-ROGUE-999');
  });

  it('Gate 8 fails and requires revalidation when spec changes after validation (§8)', async () => {
    const { specId } = await createSpecWithApprovedScripts('simulated');

    // Wait 2100ms and modify the specification
    await new Promise((resolve) => setTimeout(resolve, 2200));

    // Update the spec file
    const specDir = store.getSpecDir(specId);
    await fs.writeFile(
      path.join(specDir, 'specification.json'),
      JSON.stringify({ title: 'Modified Title', specId, updated: true }, null, 2),
      'utf-8',
    );

    const evaluation = await qualityGateService.evaluate(specId);
    const gate8 = evaluation.gates.find(
      (g) => g.gate === 'SPEC_UP_TO_DATE_NO_REVALIDATION_REQUIRED',
    );
    expect(gate8?.passed).toBe(false);
    expect(gate8?.details).toContain('Revalidation is required');
    expect(evaluation.revalidationRequired).toBe(true);
    expect(evaluation.passed).toBe(false);
  });

  it('assertGatesPass succeeds when all gates pass and throws QualityGateError when gates fail', async () => {
    const { specId } = await createSpecWithApprovedScripts('simulated');

    // Should pass without error
    const evaluation = await qualityGateService.assertGatesPass(specId);
    expect(evaluation.passed).toBe(true);

    // Tamper with approval record to status Draft
    await store.saveSpecArtifacts(specId, {
      approvalRecord: {
        specId,
        status: 'Draft',
        reviewer: 'QA',
        comments: 'Reverted to draft',
        approvedTestCases: [],
        timestamp: new Date().toISOString(),
      },
    });

    // Should throw QualityGateError
    await expect(qualityGateService.assertGatesPass(specId)).rejects.toThrow(QualityGateError);
  });
});
