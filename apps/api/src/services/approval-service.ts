import {
  ApprovalDecisionRequestSchema,
  ApprovalLoopbackRequestSchema,
  ApprovalRecordSchema,
  TestCaseSchema,
  type ApprovalDecisionRequest,
  type ApprovalHistoryEntry,
  type ApprovalLoopbackRequest,
  type ApprovalRecord,
  type ApprovalStatus,
  type CanProceedResponse,
  type SpecArtifactsPayload,
  type TestCase,
} from '@qaa/shared';
import { z } from 'zod';
import type { ProviderRegistry } from '../providers/registry.js';
import type { FileStore } from '../storage/file-store.js';
import type { IntakeService, LLMRequestOptions } from './intake-service.js';

export class ApprovalGateError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, code = 'APPROVAL_GATE_ERROR', status = 400) {
    super(message);
    this.name = 'ApprovalGateError';
    this.code = code;
    this.status = status;
  }
}

/**
 * State Transition Rules (§3.4)
 * - Only approved test cases proceed to Playwright script generation.
 * - Rejected or clarified test cases return to the specification or test-case generation stage.
 */
export const ALLOWED_TRANSITIONS: Record<ApprovalStatus, readonly ApprovalStatus[]> = {
  Draft: ['Draft', 'Under Review', 'Approved', 'Rejected', 'Needs Clarification'],
  'Under Review': ['Under Review', 'Approved', 'Rejected', 'Needs Clarification', 'Draft'],
  Approved: ['Approved', 'Under Review', 'Draft', 'Needs Clarification', 'Rejected'],
  Rejected: ['Rejected', 'Draft', 'Under Review'],
  'Needs Clarification': ['Needs Clarification', 'Draft', 'Under Review'],
} as const;

export class ApprovalService {
  constructor(
    private readonly store: FileStore,
    private readonly intakeService: IntakeService,
    private readonly registry?: ProviderRegistry,
  ) {}

  /**
   * Retrieves the current approval record for a specification (§3.4)
   */
  async getApprovalRecord(specId: string): Promise<ApprovalRecord> {
    const exists = await this.store.specExists(specId);
    if (!exists) {
      throw new ApprovalGateError(`Specification "${specId}" not found.`, 'NOT_FOUND', 404);
    }

    const artifacts = await this.store.readSpecArtifacts(specId);
    if (artifacts?.approvalRecord) {
      return ApprovalRecordSchema.parse(artifacts.approvalRecord);
    }

    // Default to Draft if file missing
    const now = new Date().toISOString();
    const fallbackRecord: ApprovalRecord = {
      specId,
      status: 'Draft',
      reviewer: 'System',
      comments: 'Auto-initialized Draft approval record',
      approvedTestCases: [],
      timestamp: now,
      history: [
        {
          fromStatus: 'Draft',
          toStatus: 'Draft',
          reviewer: 'System',
          comments: 'Auto-initialized Draft approval record',
          approvedTestCases: [],
          timestamp: now,
        },
      ],
    };

    await this.store.saveSpecArtifacts(specId, { approvalRecord: fallbackRecord });
    return fallbackRecord;
  }

  /**
   * Submits a human approval decision or status transition (§3.4)
   */
  async submitDecision(specId: string, rawInput: unknown): Promise<ApprovalRecord> {
    const exists = await this.store.specExists(specId);
    if (!exists) {
      throw new ApprovalGateError(`Specification "${specId}" not found.`, 'NOT_FOUND', 404);
    }

    const decision: ApprovalDecisionRequest = ApprovalDecisionRequestSchema.parse(rawInput);
    const artifacts = await this.store.readSpecArtifacts(specId);

    const currentRecord = artifacts?.approvalRecord
      ? ApprovalRecordSchema.parse(artifacts.approvalRecord)
      : await this.getApprovalRecord(specId);

    const currentStatus = currentRecord.status;
    const targetStatus = decision.status;

    // Validate allowed transition
    const allowed = ALLOWED_TRANSITIONS[currentStatus];
    if (!allowed.includes(targetStatus)) {
      throw new ApprovalGateError(
        `Invalid status transition from "${currentStatus}" to "${targetStatus}". Allowed transitions from "${currentStatus}" are: ${allowed.join(', ')}.`,
        'INVALID_TRANSITION',
        400,
      );
    }

    // Validate reviewer name
    const reviewer = decision.reviewer.trim();
    if (!reviewer) {
      throw new ApprovalGateError(
        'Reviewer name is required and cannot be empty.',
        'VALIDATION_ERROR',
        400,
      );
    }

    // Validate comments for Rejected and Needs Clarification
    const comments = (decision.comments || '').trim();
    if (targetStatus === 'Rejected' && !comments) {
      throw new ApprovalGateError(
        'Reviewer comments are required when rejecting test cases (§3.4).',
        'VALIDATION_ERROR',
        400,
      );
    }

    if (targetStatus === 'Needs Clarification' && !comments) {
      throw new ApprovalGateError(
        'Reviewer comments explaining the ambiguity or questions are required for "Needs Clarification" (§3.4).',
        'VALIDATION_ERROR',
        400,
      );
    }

    // Handle test case checks and resolved approved list
    const testCases: TestCase[] = Array.isArray(artifacts?.testCasesJson)
      ? z.array(TestCaseSchema).parse(artifacts?.testCasesJson)
      : [];

    let resolvedApprovedTestCases: string[] = [];

    if (targetStatus === 'Approved') {
      if (testCases.length === 0) {
        throw new ApprovalGateError(
          `Cannot approve specification "${specId}" because no test cases have been generated yet. Please generate test cases before approval (§3.3, §3.4).`,
          'PRECONDITION_FAILED',
          400,
        );
      }

      if (decision.approvedTestCases && decision.approvedTestCases.length > 0) {
        const existingIds = new Set(testCases.map((tc) => tc.id));
        for (const tcId of decision.approvedTestCases) {
          if (!existingIds.has(tcId)) {
            throw new ApprovalGateError(
              `Test case "${tcId}" does not exist in specification "${specId}". Available test cases: ${Array.from(existingIds).join(', ')}.`,
              'INVALID_TEST_CASE_ID',
              400,
            );
          }
        }
        resolvedApprovedTestCases = [...decision.approvedTestCases];
      } else {
        // By default, approving approves all test cases of the spec
        resolvedApprovedTestCases = testCases.map((tc) => tc.id);
      }
    } else {
      // In Draft, Under Review, Rejected, or Needs Clarification, no test cases are approved
      resolvedApprovedTestCases = [];
    }

    const now = new Date().toISOString();
    const historyEntry: ApprovalHistoryEntry = {
      fromStatus: currentStatus,
      toStatus: targetStatus,
      reviewer,
      comments: comments || (targetStatus === 'Approved' ? 'Approved by reviewer' : ''),
      approvedTestCases: resolvedApprovedTestCases,
      timestamp: now,
    };

    const updatedRecord: ApprovalRecord = {
      specId,
      status: targetStatus,
      reviewer,
      comments: comments || (targetStatus === 'Approved' ? 'Approved by reviewer' : ''),
      approvedTestCases: resolvedApprovedTestCases,
      timestamp: now,
      history: [...(currentRecord.history || []), historyEntry],
    };

    await this.store.saveSpecArtifacts(specId, {
      approvalRecord: updatedRecord,
    });

    return updatedRecord;
  }

  /**
   * Evaluates if test cases for a spec can proceed to Playwright script generation (§3.4, §3.5)
   * Rule: "Only test cases with status Approved can proceed to Playwright script generation."
   */
  async canProceedToScriptGeneration(specId: string): Promise<CanProceedResponse> {
    const exists = await this.store.specExists(specId);
    if (!exists) {
      throw new ApprovalGateError(`Specification "${specId}" not found.`, 'NOT_FOUND', 404);
    }

    const artifacts = await this.store.readSpecArtifacts(specId);
    const testCases: TestCase[] = Array.isArray(artifacts?.testCasesJson)
      ? (artifacts!.testCasesJson as TestCase[])
      : [];

    const record = artifacts?.approvalRecord
      ? ApprovalRecordSchema.parse(artifacts.approvalRecord)
      : null;

    const status: ApprovalStatus = record?.status ?? 'Draft';
    const approvedTestCases = record?.approvedTestCases ?? [];

    if (status !== 'Approved') {
      return {
        canProceed: false,
        status,
        approvedTestCases: [],
        totalTestCases: testCases.length,
        reason: `Specification is currently in "${status}" status. Only test cases with status "Approved" can proceed to Playwright script generation (§3.4).`,
      };
    }

    if (approvedTestCases.length === 0) {
      return {
        canProceed: false,
        status: 'Approved',
        approvedTestCases: [],
        totalTestCases: testCases.length,
        reason:
          'Specification is marked "Approved", but no specific test cases are approved (§3.4).',
      };
    }

    return {
      canProceed: true,
      status: 'Approved',
      approvedTestCases,
      totalTestCases: testCases.length,
    };
  }

  /**
   * Rejected or clarified test cases loop back to specification or test-case generation stage (§3.4)
   * Automatically incorporates reviewer feedback and transitions status back to Draft (or requested status).
   */
  async loopback(
    specId: string,
    rawInput: unknown,
    options?: LLMRequestOptions,
  ): Promise<SpecArtifactsPayload> {
    const exists = await this.store.specExists(specId);
    if (!exists) {
      throw new ApprovalGateError(`Specification "${specId}" not found.`, 'NOT_FOUND', 404);
    }

    const request: ApprovalLoopbackRequest = ApprovalLoopbackRequestSchema.parse(rawInput || {});
    const artifacts = await this.store.readSpecArtifacts(specId);
    const currentRecord = artifacts?.approvalRecord
      ? ApprovalRecordSchema.parse(artifacts.approvalRecord)
      : await this.getApprovalRecord(specId);

    // Resolve feedback: explicit feedback takes precedence; otherwise pull comments from approvalRecord
    const feedback =
      request.feedback?.trim() ||
      (['Rejected', 'Needs Clarification'].includes(currentRecord.status)
        ? currentRecord.comments
        : '') ||
      '';

    const mergedOptions: LLMRequestOptions = {
      ...options,
      feedback: feedback || undefined,
    };

    // Execute generation stage
    if (request.stage === 'spec' || request.stage === 'all') {
      await this.intakeService.generateSpecification(specId, mergedOptions);
    }

    if (request.stage === 'test-cases' || request.stage === 'all') {
      await this.intakeService.generateTestCases(specId, mergedOptions);
    }

    // Reset status to targetStatus (default 'Draft') and record audit entry
    const now = new Date().toISOString();
    const targetStatus = request.targetStatus;
    const historyEntry: ApprovalHistoryEntry = {
      fromStatus: currentRecord.status,
      toStatus: targetStatus,
      reviewer: 'System (Loopback)',
      comments: feedback
        ? `Loopback stage "${request.stage}" completed incorporating feedback: "${feedback}"`
        : `Loopback stage "${request.stage}" completed`,
      approvedTestCases: [],
      timestamp: now,
    };

    const updatedRecord: ApprovalRecord = {
      specId,
      status: targetStatus,
      reviewer: 'System (Loopback)',
      comments: feedback ? `Incorporated reviewer feedback: ${feedback}` : 'Revisions completed',
      approvedTestCases: [],
      timestamp: now,
      history: [...(currentRecord.history || []), historyEntry],
    };

    await this.store.saveSpecArtifacts(specId, {
      approvalRecord: updatedRecord,
    });

    const updatedArtifacts = await this.intakeService.getSpec(specId);
    if (!updatedArtifacts) {
      throw new ApprovalGateError(
        `Specification "${specId}" not found after loopback.`,
        'NOT_FOUND',
        404,
      );
    }

    return updatedArtifacts;
  }

  /**
   * Internal hook: when an existing spec's artifacts are modified or regenerated directly,
   * reset approval to Draft if it was previously Approved, Rejected, or Needs Clarification.
   */
  async handleArtifactUpdate(specId: string, reason: string): Promise<void> {
    const artifacts = await this.store.readSpecArtifacts(specId);
    if (!artifacts?.approvalRecord) return;

    const currentRecord = ApprovalRecordSchema.parse(artifacts.approvalRecord);
    if (currentRecord.status === 'Draft') return;

    const now = new Date().toISOString();
    const historyEntry: ApprovalHistoryEntry = {
      fromStatus: currentRecord.status,
      toStatus: 'Draft',
      reviewer: 'System (Artifact Update)',
      comments: `Status reset to Draft: ${reason}`,
      approvedTestCases: [],
      timestamp: now,
    };

    const updatedRecord: ApprovalRecord = {
      ...currentRecord,
      status: 'Draft',
      reviewer: 'System (Artifact Update)',
      comments: `Status reset to Draft: ${reason}`,
      approvedTestCases: [],
      timestamp: now,
      history: [...(currentRecord.history || []), historyEntry],
    };

    await this.store.saveSpecArtifacts(specId, {
      approvalRecord: updatedRecord,
    });
  }
}
