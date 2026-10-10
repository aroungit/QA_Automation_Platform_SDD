import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ValidationReport } from '@qaa/shared';
import { ApprovalService } from '../src/services/approval-service.js';
import { IntakeService } from '../src/services/intake-service.js';
import { QualityGateError, QualityGateService } from '../src/services/quality-gate-service.js';
import { RepositoryService } from '../src/services/repository-service.js';
import { ScriptGenerator } from '../src/services/script-generator.js';
import { ValidationService } from '../src/services/validation-service.js';
import { FileStore } from '../src/storage/file-store.js';

describe('RepositoryService (§3.7, §8)', { timeout: 30000 }, () => {
  let tmpDir: string;
  let store: FileStore;
  let intakeService: IntakeService;
  let approvalService: ApprovalService;
  let scriptGenerator: ScriptGenerator;
  let validationService: ValidationService;
  let qualityGateService: QualityGateService;
  let repositoryService: RepositoryService;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'qaa-repo-service-'));
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
    repositoryService = new RepositoryService(store, qualityGateService, validationService);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  async function createSpecWithApprovedScripts(executionMode: 'simulated' | 'real' = 'simulated') {
    const intake = await intakeService.processIntake({
      title: 'User Login Feature',
      story: 'As a registered user, I want to log in to access the system.',
      acceptanceCriteria: ['Valid login succeeds', 'Invalid login fails'],
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

  it('promotes validated artifacts to /automation and saves promotion record (§3.7, §8)', async () => {
    const { specId, report } = await createSpecWithApprovedScripts('simulated');
    expect(report.overallStatus).toBe('PASSED');

    const result = await repositoryService.promote(specId, {
      commitMessage: `feat(automation): [${specId}] promote validated artifacts and scripts`,
      autoCommit: false,
    });

    expect(result.success).toBe(true);
    expect(result.specId).toBe(specId);
    expect(result.validationReportId).toBe(report.reportId);
    expect(result.promotedFiles.length).toBeGreaterThan(0);
    expect(result.qualityGateEvaluation.passed).toBe(true);

    // Verify promotion-record.json in /specs/{specId}/
    const promoRecord = await repositoryService.getPromotionRecord(specId);
    expect(promoRecord).not.toBeNull();
    expect(promoRecord?.status).toBe('promoted');
    expect(promoRecord?.revalidationRequired).toBe(false);
    expect(promoRecord?.validationReportId).toBe(report.reportId);

    // Verify automation files were written
    const autoFiles = await repositoryService.listAutomationFiles();
    expect(autoFiles.length).toBeGreaterThan(0);

    const testFile = autoFiles.find((f) => f.includes('.spec.ts'));
    expect(testFile).toBeDefined();

    // Verify rule: "Every stored script must include a passing validation report reference" (§3.7)
    const scriptContent = await repositoryService.readAutomationFile(testFile!);
    expect(scriptContent).toContain(`// Validation Report: ${report.reportId}`);
    expect(scriptContent).toContain(`// Spec ID: ${specId}`);
  });

  it('commits reference the specification ID (§3.7)', async () => {
    const { specId } = await createSpecWithApprovedScripts('simulated');

    const result = await repositoryService.promote(specId, {
      autoCommit: false, // In test environment without git repo, falls back to simulated commit info
    });

    expect(result.commit).toBeDefined();
    expect(result.commit?.message).toContain(`[${specId}]`);
    expect(result.commit?.sha).toBeDefined();
    expect(result.commit?.committedFiles.length).toBeGreaterThan(0);
  });

  it('fails promotion and keeps failed scripts in temporary workspace when Quality Gates fail (§3.7, §8)', async () => {
    const intake = await intakeService.processIntake({
      title: 'Unapproved Spec',
      story: 'Story not yet approved',
      acceptanceCriteria: ['Some criteria'],
      priority: 'low',
      generateSpec: true,
      generateTestCases: true,
    });

    const specId = intake.specId;

    // Spec is still in Draft status, no scripts generated or validated
    await expect(repositoryService.promote(specId)).rejects.toThrow(QualityGateError);

    // Verify main repository /automation has ZERO files
    const autoFiles = await repositoryService.listAutomationFiles();
    expect(autoFiles).toHaveLength(0);
  });

  it('blocks promotion if dynamic validation failed and keeps scripts in workspace (§3.6, §3.7)', async () => {
    const { specId, report } = await createSpecWithApprovedScripts('simulated');

    // Tamper report to simulate failed dynamic execution
    const failedReport: ValidationReport = {
      ...report,
      reportId: `VAL-${specId}-failed-${Date.now()}`,
      timestamp: new Date(Date.now() + 1000).toISOString(),
      overallStatus: 'FAILED',
      dynamicValidation: {
        ...report.dynamicValidation,
        passed: false,
        failedCount: 1,
      },
    };
    await store.saveExecutionReport(failedReport.reportId, failedReport);

    await expect(repositoryService.promote(specId)).rejects.toThrow(QualityGateError);

    // Scripts stay in workspace, automation folder remains empty
    const wsFiles = await store.listWorkspaceFiles();
    expect(wsFiles.length).toBeGreaterThan(0);

    const autoFiles = await repositoryService.listAutomationFiles();
    expect(autoFiles).toHaveLength(0);
  });

  it('spec change triggers revalidation and marks promotion outdated (§8)', async () => {
    const { specId } = await createSpecWithApprovedScripts('simulated');

    // Promote first
    await repositoryService.promote(specId, { autoCommit: false });
    const initialRecord = await repositoryService.getPromotionRecord(specId);
    expect(initialRecord?.status).toBe('promoted');
    expect(initialRecord?.revalidationRequired).toBe(false);

    // Modify spec via intakeService
    await intakeService.updateSpecification(specId, {
      title: 'Updated Login Requirements',
      businessObjective: 'Enhanced security login',
      actors: ['User', 'Admin'],
      preconditions: ['User exists', '2FA enabled'],
      mainFlow: [
        { step: 1, action: 'Open login page', expected: 'Form visible' },
        { step: 2, action: 'Enter credentials & 2FA', expected: 'Dashboard displayed' },
      ],
      alternateFlows: [],
      exceptionFlows: [],
      dataRequirements: [],
      acceptanceCriteria: ['Login succeeds with 2FA'],
      nonFunctionalRequirements: [],
      targetApp: 'OrangeHRM',
      environment: 'default',
    });

    // Verification: promotion record should now be marked outdated & revalidationRequired
    const outdatedRecord = await repositoryService.getPromotionRecord(specId);
    expect(outdatedRecord?.status).toBe('outdated');
    expect(outdatedRecord?.revalidationRequired).toBe(true);

    // Quality Gate 8 must fail because spec was changed
    const evaluation = await qualityGateService.evaluate(specId);
    expect(evaluation.revalidationRequired).toBe(true);
    expect(evaluation.passed).toBe(false);

    // Re-approve spec to allow revalidation (§3.4, §8)
    await approvalService.submitDecision(specId, {
      status: 'Approved',
      reviewer: 'QA Lead',
      comments: 'Updated spec re-approved',
    });

    // Run revalidate (§8)
    const newReport = await repositoryService.revalidate(specId, {
      executionMode: 'simulated',
    });
    expect(newReport.overallStatus).toBe('PASSED');

    // Promotion record should be back to promoted
    const revalidatedRecord = await repositoryService.getPromotionRecord(specId);
    expect(revalidatedRecord?.status).toBe('promoted');
    expect(revalidatedRecord?.revalidationRequired).toBe(false);
  });

  it('revalidate rejects if specification is not Approved (§3.4, §8)', async () => {
    const { specId } = await createSpecWithApprovedScripts('simulated');

    // Reset status to Draft
    await store.saveSpecArtifacts(specId, {
      approvalRecord: {
        specId,
        status: 'Draft',
        reviewer: 'QA',
        comments: 'Back to draft',
        approvedTestCases: [],
        timestamp: new Date().toISOString(),
      },
    });

    await expect(repositoryService.revalidate(specId)).rejects.toThrow(
      'must be approved before revalidation',
    );
  });

  it('lists promoted specifications and automation files (§3.7)', async () => {
    const { specId } = await createSpecWithApprovedScripts('simulated');
    await repositoryService.promote(specId, { autoCommit: false });

    const list = await repositoryService.listPromotedSpecs();
    expect(list).toHaveLength(1);
    expect(list[0]?.specId).toBe(specId);

    const files = await repositoryService.listAutomationFiles('web');
    expect(files.length).toBeGreaterThan(0);
  });
});
