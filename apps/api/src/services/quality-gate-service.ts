import {
  ApprovalRecordSchema,
  type ApprovalRecord,
  type QualityGateEvaluation,
  type QualityGateItem,
  type TestCase,
} from '@qaa/shared';
import type { FileStore } from '../storage/file-store.js';
import type { ValidationService } from './validation-service.js';

export class QualityGateError extends Error {
  readonly status: number;
  readonly code: string;
  readonly failedGates: QualityGateItem[];

  constructor(
    message: string,
    failedGates: QualityGateItem[] = [],
    code = 'QUALITY_GATE_FAILED',
    status = 400,
  ) {
    super(message);
    this.name = 'QualityGateError';
    this.code = code;
    this.status = status;
    this.failedGates = failedGates;
  }
}

export class QualityGateService {
  constructor(
    private readonly store: FileStore,
    private readonly validationService: ValidationService,
  ) {}

  /**
   * Evaluates all 8 Quality Gates (§8) for a specification:
   * 1. Approved specification exists
   * 2. Approved test cases exist
   * 3. Every script maps to an approved test case
   * 4. Scripts compile successfully
   * 5. Scripts pass automated execution
   * 6. Execution evidence is stored
   * 7. No unapproved functionality is automated
   * 8. Specification changes trigger revalidation
   */
  async evaluate(specId: string): Promise<QualityGateEvaluation> {
    const evaluatedAt = new Date().toISOString();

    const exists = await this.store.specExists(specId);
    if (!exists) {
      throw new QualityGateError(`Specification "${specId}" not found.`, [], 'NOT_FOUND', 404);
    }

    const artifacts = await this.store.readSpecArtifacts(specId);
    const promotionRecord = await this.store.readPromotionRecord(specId);
    const latestReport = await this.validationService.getLatestReport(specId);

    const approvalRecord: ApprovalRecord | undefined = artifacts?.approvalRecord
      ? ApprovalRecordSchema.parse(artifacts.approvalRecord)
      : undefined;

    const approvedTestCases: string[] = approvalRecord?.approvedTestCases ?? [];
    const testCases: TestCase[] = Array.isArray(artifacts?.testCasesJson)
      ? (artifacts!.testCasesJson as TestCase[])
      : [];

    const isApproved = approvalRecord?.status === 'Approved';

    // Check spec file modification times vs report timestamp
    let specModifiedAfterValidation = false;
    let revalidationRequired = Boolean(promotionRecord?.revalidationRequired);

    if (latestReport) {
      const reportTime = new Date(latestReport.timestamp).getTime();
      const mtimes = await this.store.getSpecFileMtimes(specId);
      const monitoredFiles = [
        'specification.json',
        'specification.md',
        'test-cases.json',
        'test-cases.md',
        'user-story.json',
        'user-story.md',
      ];

      for (const file of monitoredFiles) {
        if (mtimes[file]) {
          // Allow 2000ms buffer for filesystem clock skew
          if (mtimes[file].getTime() > reportTime + 2000) {
            specModifiedAfterValidation = true;
            revalidationRequired = true;
            break;
          }
        }
      }
    } else {
      revalidationRequired = true;
    }

    // Gate 1: Approved specification exists (§3.4, §8)
    const gate1: QualityGateItem = {
      gate: 'APPROVED_SPECIFICATION',
      passed: Boolean(artifacts?.specification || artifacts?.specificationJson) && isApproved,
      name: 'Approved Specification Exists',
      description: 'Specification exists and has been approved by a reviewer.',
      details: isApproved
        ? `Specification "${specId}" is in "Approved" status.`
        : `Specification "${specId}" is in "${approvalRecord?.status ?? 'Draft'}" status. Approval required (§3.4, §8).`,
    };

    // Gate 2: Approved test cases exist (§3.4, §8)
    const hasApprovedCases = isApproved && approvedTestCases.length > 0;
    const gate2: QualityGateItem = {
      gate: 'APPROVED_TEST_CASES',
      passed: hasApprovedCases,
      name: 'Approved Test Cases Exist',
      description: 'At least one test case has been reviewed and approved.',
      details: hasApprovedCases
        ? `${approvedTestCases.length} test case(s) approved: ${approvedTestCases.join(', ')}.`
        : `No approved test cases found for "${specId}". Total candidate test cases: ${testCases.length}.`,
    };

    // Gate 3: Every script maps to an approved test case (§3.5, §3.6, §8)
    const conformance = latestReport?.conformanceCheck;
    const allApprovedCovered =
      Boolean(conformance) &&
      conformance!.missing.length === 0 &&
      conformance!.covered.length > 0 &&
      conformance!.passed;

    const gate3: QualityGateItem = {
      gate: 'SCRIPTS_MAP_TO_APPROVED_TEST_CASES',
      passed: allApprovedCovered,
      name: 'Scripts Map to Approved Test Cases',
      description: 'Every approved test case has a corresponding automated test script.',
      details: conformance
        ? conformance.missing.length === 0
          ? `All ${conformance.covered.length} approved test case(s) are mapped to executable scripts.`
          : `Missing test scripts for approved test cases: ${conformance.missing.join(', ')}.`
        : 'No validation report available to verify test script mapping.',
    };

    // Gate 4: Scripts compile successfully (§3.6, §8)
    const staticValidation = latestReport?.staticValidation;
    const scriptsCompile =
      Boolean(staticValidation) &&
      staticValidation!.typeScriptCheck.passed &&
      staticValidation!.passed;

    const gate4: QualityGateItem = {
      gate: 'SCRIPTS_COMPILE_SUCCESSFULLY',
      passed: scriptsCompile,
      name: 'Scripts Compile Successfully',
      description:
        'TypeScript compilation, syntax, linting, imports, and selectors validate cleanly.',
      details: staticValidation
        ? staticValidation.passed
          ? 'TypeScript compilation, lint, and selector checks passed with zero errors.'
          : `Static validation failed: ${[
              ...staticValidation.typeScriptCheck.errors,
              ...staticValidation.lintCheck.errors,
              ...staticValidation.importValidation.errors,
            ].join('; ')}`
        : 'No static validation results available.',
    };

    // Gate 5: Scripts pass automated execution (§3.6, §8)
    const dynamicValidation = latestReport?.dynamicValidation;
    const executionPassed =
      Boolean(dynamicValidation) &&
      dynamicValidation!.passed &&
      dynamicValidation!.failedCount === 0 &&
      (latestReport!.overallStatus === 'PASSED' || latestReport!.overallStatus === 'HEALED_PASSED');

    const gate5: QualityGateItem = {
      gate: 'SCRIPTS_PASS_AUTOMATED_EXECUTION',
      passed: executionPassed,
      name: 'Scripts Pass Automated Execution',
      description:
        'All automated test cases execute successfully against the target application without failure.',
      details: dynamicValidation
        ? dynamicValidation.passed && dynamicValidation.failedCount === 0
          ? `${dynamicValidation.passedCount} test(s) passed execution (${latestReport?.overallStatus}).`
          : `${dynamicValidation.failedCount} test(s) failed execution out of ${dynamicValidation.totalTests}.`
        : 'No dynamic execution results available.',
    };

    // Gate 6: Execution evidence is stored (§3.7, §8)
    let evidenceStored = false;
    if (latestReport) {
      const storedReport = await this.store.readExecutionReport(latestReport.reportId);
      evidenceStored = Boolean(storedReport);
    }

    const gate6: QualityGateItem = {
      gate: 'EXECUTION_EVIDENCE_STORED',
      passed: evidenceStored,
      name: 'Execution Evidence Stored',
      description:
        'Execution report and artifacts (screenshots, traces, logs) are permanently stored in reports/execution-results.',
      details: evidenceStored
        ? `Execution evidence verified in reports store (Report ID: ${latestReport?.reportId}).`
        : 'Execution report evidence not found in reports/execution-results.',
    };

    // Gate 7: No unapproved functionality is automated (§3.6, §8)
    const noUnapproved = Boolean(conformance) && conformance!.unmapped.length === 0;

    const gate7: QualityGateItem = {
      gate: 'NO_UNAPPROVED_FUNCTIONALITY_AUTOMATED',
      passed: noUnapproved,
      name: 'No Unapproved Functionality Automated',
      description:
        'Only explicitly approved test cases are automated; unmapped or extra tests are rejected.',
      details: conformance
        ? conformance.unmapped.length === 0
          ? 'Zero unapproved or unmapped tests detected.'
          : `Unapproved test cases detected: ${conformance.unmapped.join(', ')}. Unapproved functionality cannot be promoted (§8).`
        : 'No conformance report available to check unmapped functionality.',
    };

    // Gate 8: Specification changes trigger revalidation (§8)
    const specUpToDate =
      !specModifiedAfterValidation && !revalidationRequired && Boolean(latestReport);

    const gate8: QualityGateItem = {
      gate: 'SPEC_UP_TO_DATE_NO_REVALIDATION_REQUIRED',
      passed: specUpToDate,
      name: 'Specification Up-To-Date (No Revalidation Required)',
      description:
        'Artifacts reflect the current specification state; modifications require revalidation.',
      details: !latestReport
        ? 'Specification has never been validated. Validation required (§8).'
        : specModifiedAfterValidation
          ? 'Specification or test cases were modified after the last validation run. Revalidation is required (§8).'
          : revalidationRequired
            ? 'Revalidation has been triggered or is required due to pending updates (§8).'
            : 'Specification is up-to-date with latest validation evidence.',
    };

    const gates: QualityGateItem[] = [gate1, gate2, gate3, gate4, gate5, gate6, gate7, gate8];

    const allPassed = gates.every((g) => g.passed);

    return {
      specId,
      passed: allPassed,
      status: allPassed ? 'PASSED' : 'FAILED',
      gates,
      validationReportId: latestReport?.reportId,
      revalidationRequired: !specUpToDate,
      promoted: promotionRecord?.status === 'promoted' && !revalidationRequired,
      promotedAt: promotionRecord?.promotedAt,
      evaluatedAt,
    };
  }

  /**
   * Asserts all quality gates pass, or throws QualityGateError
   */
  async assertGatesPass(specId: string): Promise<QualityGateEvaluation> {
    const evaluation = await this.evaluate(specId);
    if (!evaluation.passed) {
      const failed = evaluation.gates.filter((g) => !g.passed);
      const summary = failed.map((g) => `- ${g.name}: ${g.details}`).join('\n');
      throw new QualityGateError(
        `Quality Gates failed for specification "${specId}". Artifacts cannot be promoted to the repository (§8):\n${summary}`,
        failed,
        'QUALITY_GATES_FAILED',
        400,
      );
    }
    return evaluation;
  }
}
