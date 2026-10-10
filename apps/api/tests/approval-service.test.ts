import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';
import { ApprovalGateError, ApprovalService } from '../src/services/approval-service.js';
import { IntakeService } from '../src/services/intake-service.js';
import { FileStore } from '../src/storage/file-store.js';

describe('ApprovalService (§3.4)', () => {
  let tempDir: string;
  let store: FileStore;
  let intakeService: IntakeService;
  let approvalService: ApprovalService;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'qaa-approval-service-test-'));
    const config = loadConfig({}, tempDir);
    store = new FileStore(config.storage);
    await store.init();
    intakeService = new IntakeService(store);
    approvalService = intakeService.getApprovalService();
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  async function createSpecWithTestCases(slug = 'LOGIN') {
    return intakeService.processIntake({
      title: 'Login to Application',
      story: 'As a registered user, I want to log in, so that I can access my account.',
      acceptanceCriteria: [
        'Valid credentials redirect to dashboard',
        'Invalid credentials show error message',
      ],
      priority: 'high',
      platform: 'web',
      targetApp: 'OrangeHRM',
      slug,
      generateSpec: true,
      generateTestCases: true,
    });
  }

  async function createSpecWithoutTestCases(slug = 'DRAFT') {
    return intakeService.processIntake({
      title: 'Draft Feature',
      story: 'As a user, I want draft features.',
      acceptanceCriteria: ['Feature works as intended'],
      priority: 'medium',
      platform: 'web',
      targetApp: 'OrangeHRM',
      slug,
      generateSpec: false,
      generateTestCases: false,
    });
  }

  it('getApprovalRecord returns Draft record with initial history for new intake', async () => {
    const spec = await createSpecWithTestCases('AUTH');
    const record = await approvalService.getApprovalRecord(spec.specId);

    expect(record.specId).toBe(spec.specId);
    expect(record.status).toBe('Draft');
    expect(record.reviewer).toBe('System');
    expect(record.approvedTestCases).toEqual([]);
    expect(record.history).toBeDefined();
    expect(record.history!.length).toBeGreaterThanOrEqual(1);
    expect(record.history![0]?.fromStatus).toBe('Draft');
    expect(record.history![0]?.toStatus).toBe('Draft');
  });

  it('getApprovalRecord throws NOT_FOUND for non-existent spec', async () => {
    await expect(approvalService.getApprovalRecord('SPEC-NONEXISTENT-999')).rejects.toThrow(
      ApprovalGateError,
    );
  });

  it('transitions Draft -> Under Review -> Approved (all test cases)', async () => {
    const spec = await createSpecWithTestCases('REVIEW');
    const specId = spec.specId;

    // 1. Draft -> Under Review
    const underReview = await approvalService.submitDecision(specId, {
      status: 'Under Review',
      reviewer: 'QA Lead',
      comments: 'Submitting generated test cases for review',
    });
    expect(underReview.status).toBe('Under Review');
    expect(underReview.reviewer).toBe('QA Lead');

    // 2. Under Review -> Approved
    const approved = await approvalService.submitDecision(specId, {
      status: 'Approved',
      reviewer: 'QA Lead',
      comments: 'All test cases verified against specification criteria',
    });
    expect(approved.status).toBe('Approved');
    expect(approved.approvedTestCases.length).toBeGreaterThan(0);
    expect(approved.history).toBeDefined();
    expect(approved.history!.length).toBe(3); // Initial + Under Review + Approved

    // Verify stored on disk
    const onDisk = await approvalService.getApprovalRecord(specId);
    expect(onDisk.status).toBe('Approved');
    expect(onDisk.approvedTestCases).toEqual(approved.approvedTestCases);
  });

  it('allows approving a specific subset of test cases', async () => {
    const spec = await createSpecWithTestCases('SUBSET');
    const specId = spec.specId;
    const testCases = spec.testCasesJson!;
    expect(testCases.length).toBeGreaterThanOrEqual(2);

    const subsetIds = [testCases[0]!.id];

    const approved = await approvalService.submitDecision(specId, {
      status: 'Approved',
      reviewer: 'Reviewer Alice',
      comments: 'Approving first test case only',
      approvedTestCases: subsetIds,
    });

    expect(approved.status).toBe('Approved');
    expect(approved.approvedTestCases).toEqual(subsetIds);
  });

  it('rejects approval if a non-existent test case ID is provided', async () => {
    const spec = await createSpecWithTestCases('BADTC');
    const specId = spec.specId;

    await expect(
      approvalService.submitDecision(specId, {
        status: 'Approved',
        reviewer: 'Reviewer Bob',
        comments: 'Approving invalid TC',
        approvedTestCases: ['TC-INVALID-999'],
      }),
    ).rejects.toThrow(/does not exist in specification/);
  });

  it('prevents approving a specification that has no test cases', async () => {
    const spec = await createSpecWithoutTestCases('NOTC');
    const specId = spec.specId;

    await expect(
      approvalService.submitDecision(specId, {
        status: 'Approved',
        reviewer: 'QA Lead',
        comments: 'Attempting to approve without test cases',
      }),
    ).rejects.toThrow(/no test cases have been generated yet/);
  });

  it('enforces comments when transitioning to Rejected or Needs Clarification', async () => {
    const spec = await createSpecWithTestCases('REJ');
    const specId = spec.specId;

    // Transition to Under Review first
    await approvalService.submitDecision(specId, {
      status: 'Under Review',
      reviewer: 'Lead',
      comments: 'Ready for check',
    });

    // Rejection without comments must fail
    await expect(
      approvalService.submitDecision(specId, {
        status: 'Rejected',
        reviewer: 'Reviewer',
        comments: '',
      }),
    ).rejects.toThrow(/Reviewer comments are required when rejecting test cases/);

    // Needs Clarification without comments must fail
    await expect(
      approvalService.submitDecision(specId, {
        status: 'Needs Clarification',
        reviewer: 'Reviewer',
        comments: '   ',
      }),
    ).rejects.toThrow(/Reviewer comments explaining the ambiguity or questions are required/);

    // Rejection with comments succeeds
    const rejected = await approvalService.submitDecision(specId, {
      status: 'Rejected',
      reviewer: 'Lead Reviewer',
      comments: 'Missing boundary value validations for password field',
    });
    expect(rejected.status).toBe('Rejected');
    expect(rejected.approvedTestCases).toEqual([]);
    expect(rejected.comments).toBe('Missing boundary value validations for password field');
  });

  it('enforces transition rules: blocks direct transition from Rejected to Approved', async () => {
    const spec = await createSpecWithTestCases('BLOCKED');
    const specId = spec.specId;

    await approvalService.submitDecision(specId, {
      status: 'Rejected',
      reviewer: 'Reviewer',
      comments: 'Incomplete flow',
    });

    // Direct Rejected -> Approved is illegal (§3.4)
    await expect(
      approvalService.submitDecision(specId, {
        status: 'Approved',
        reviewer: 'Reviewer',
        comments: 'Skip loopback',
      }),
    ).rejects.toThrow(/Invalid status transition from "Rejected" to "Approved"/);
  });

  it('enforces transition rules: blocks direct transition from Needs Clarification to Approved', async () => {
    const spec = await createSpecWithTestCases('CLARIFY');
    const specId = spec.specId;

    await approvalService.submitDecision(specId, {
      status: 'Needs Clarification',
      reviewer: 'Reviewer',
      comments: 'Ambiguous actor role',
    });

    // Direct Needs Clarification -> Approved is illegal (§3.4)
    await expect(
      approvalService.submitDecision(specId, {
        status: 'Approved',
        reviewer: 'Reviewer',
        comments: 'Skip loopback',
      }),
    ).rejects.toThrow(/Invalid status transition from "Needs Clarification" to "Approved"/);
  });

  it('canProceedToScriptGeneration returns true only for Approved specs with test cases (§3.4)', async () => {
    const spec = await createSpecWithTestCases('GATE');
    const specId = spec.specId;

    // 1. Initial Draft state
    let check = await approvalService.canProceedToScriptGeneration(specId);
    expect(check.canProceed).toBe(false);
    expect(check.status).toBe('Draft');
    expect(check.reason).toContain('Only test cases with status "Approved" can proceed');

    // 2. Under Review state
    await approvalService.submitDecision(specId, {
      status: 'Under Review',
      reviewer: 'Reviewer',
      comments: 'Reviewing',
    });
    check = await approvalService.canProceedToScriptGeneration(specId);
    expect(check.canProceed).toBe(false);
    expect(check.status).toBe('Under Review');

    // 3. Rejected state
    await approvalService.submitDecision(specId, {
      status: 'Rejected',
      reviewer: 'Reviewer',
      comments: 'Needs rework',
    });
    check = await approvalService.canProceedToScriptGeneration(specId);
    expect(check.canProceed).toBe(false);
    expect(check.status).toBe('Rejected');

    // 4. Reset to Draft -> Approved
    await approvalService.submitDecision(specId, {
      status: 'Draft',
      reviewer: 'Developer',
      comments: 'Resetting to draft after adjustments',
    });
    await approvalService.submitDecision(specId, {
      status: 'Approved',
      reviewer: 'Senior QA',
      comments: 'Approved now',
    });

    check = await approvalService.canProceedToScriptGeneration(specId);
    expect(check.canProceed).toBe(true);
    expect(check.status).toBe('Approved');
    expect(check.approvedTestCases.length).toBeGreaterThan(0);
  });

  it('loopback returns rejected test cases to generation stage with feedback (§3.4)', async () => {
    const spec = await createSpecWithTestCases('LOOP');
    const specId = spec.specId;

    // Reject with reviewer comments
    await approvalService.submitDecision(specId, {
      status: 'Rejected',
      reviewer: 'QA Lead',
      comments: 'Include lockout after 3 failed login attempts',
    });

    // Loopback with explicit feedback
    const revised = await approvalService.loopback(specId, {
      stage: 'all',
      feedback: 'Include lockout after 3 failed login attempts and alert banner',
      targetStatus: 'Draft',
    });

    expect(revised.specId).toBe(specId);
    expect(revised.approvalRecord?.status).toBe('Draft');
    expect(revised.approvalRecord?.reviewer).toBe('System (Loopback)');
    expect(revised.testCasesJson?.length).toBeGreaterThan(0);

    // Verify history includes loopback entry
    const record = await approvalService.getApprovalRecord(specId);
    expect(record.history).toBeDefined();
    const lastHistory = record.history![record.history!.length - 1];
    expect(lastHistory?.fromStatus).toBe('Rejected');
    expect(lastHistory?.toStatus).toBe('Draft');
    expect(lastHistory?.comments).toContain('Include lockout after 3 failed login attempts');
  });

  it('loopback automatically uses approval comments if explicit feedback is omitted', async () => {
    const spec = await createSpecWithTestCases('AUTOFEED');
    const specId = spec.specId;

    // Mark as Needs Clarification
    await approvalService.submitDecision(specId, {
      status: 'Needs Clarification',
      reviewer: 'Product Owner',
      comments: 'Clarify whether session timeout is 15 or 30 minutes',
    });

    // Loopback without explicit feedback
    const revised = await approvalService.loopback(specId, {
      stage: 'test-cases',
    });

    expect(revised.approvalRecord?.status).toBe('Draft');
    const record = await approvalService.getApprovalRecord(specId);
    expect(record.history).toBeDefined();
    expect(record.history![record.history!.length - 1]?.comments).toContain(
      'Clarify whether session timeout is 15 or 30 minutes',
    );
  });

  it('handleArtifactUpdate automatically resets Approved spec to Draft on regeneration', async () => {
    const spec = await createSpecWithTestCases('RESET');
    const specId = spec.specId;

    // Approve
    await approvalService.submitDecision(specId, {
      status: 'Approved',
      reviewer: 'QA Approver',
      comments: 'All good',
    });

    let check = await approvalService.canProceedToScriptGeneration(specId);
    expect(check.canProceed).toBe(true);

    // Now regenerate test cases
    await intakeService.generateTestCases(specId);

    // Status must have been reset to Draft
    const record = await approvalService.getApprovalRecord(specId);
    expect(record.status).toBe('Draft');
    expect(record.approvedTestCases).toEqual([]);

    check = await approvalService.canProceedToScriptGeneration(specId);
    expect(check.canProceed).toBe(false);
  });
});
