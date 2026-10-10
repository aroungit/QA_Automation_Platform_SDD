import {
  ApprovalRecordSchema,
  SpecificationSchema,
  UserStoryRecordSchema,
  type ApprovalRecord,
  type HealRequest,
  type HealResponse,
  type HealingSummary,
  type Platform,
  type Specification,
  type UserStoryRecord,
  type ValidateSpecRequest,
  type ValidationOverallStatus,
  type ValidationReport,
} from '@qaa/shared';
import type { AppConfig } from '../config.js';
import { getConfig } from '../config.js';
import type { ProviderRegistry } from '../providers/registry.js';
import { getProviderRegistry } from '../providers/registry.js';
import type { FileStore } from '../storage/file-store.js';
import { ApprovalGateError } from './approval-service.js';
import { ConformanceChecker } from './conformance-checker.js';
import { DynamicValidator } from './dynamic-validator.js';
import { PlaywrightHealerAgent } from './healer-agent.js';
import { StaticValidator } from './static-validator.js';

export class ValidationError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, code = 'VALIDATION_ERROR', status = 400) {
    super(message);
    this.name = 'ValidationError';
    this.code = code;
    this.status = status;
  }
}

export class ValidationService {
  private readonly staticValidator: StaticValidator;
  private readonly dynamicValidator: DynamicValidator;
  private readonly conformanceChecker: ConformanceChecker;
  private readonly healerAgent: PlaywrightHealerAgent;

  constructor(
    private readonly store: FileStore,
    private readonly registry?: ProviderRegistry,
    private readonly config?: AppConfig,
  ) {
    this.staticValidator = new StaticValidator(store);
    this.dynamicValidator = new DynamicValidator(store, config);
    this.conformanceChecker = new ConformanceChecker();
    this.healerAgent = new PlaywrightHealerAgent(store, registry, config);
  }

  private getConfig(): AppConfig {
    return this.config ?? getConfig();
  }

  private getRegistry(): ProviderRegistry {
    return this.registry ?? getProviderRegistry();
  }

  /**
   * Executes the full automated validation pipeline (§3.6).
   * 1. Static validation (TypeScript compilation, lint, selectors, imports)
   * 2. Dynamic validation (Playwright execution against target environment)
   * 3. Conformance check (Approved test cases coverage, unmapped tests, failed tests)
   * 4. Bounded auto-healing if failures occur and autoHeal is enabled
   * 5. Saves validation report to reports/execution-results
   */
  async validate(specId: string, options?: ValidateSpecRequest): Promise<ValidationReport> {
    const exists = await this.store.specExists(specId);
    if (!exists) {
      throw new ValidationError(`Specification "${specId}" not found.`, 'NOT_FOUND', 404);
    }

    const artifacts = await this.store.readSpecArtifacts(specId);
    if (!artifacts) {
      throw new ValidationError(
        `Artifacts for specification "${specId}" not found.`,
        'NOT_FOUND',
        404,
      );
    }

    // 1. Approval Gate check (§3.4, §3.6)
    const approvalRecord: ApprovalRecord | undefined = artifacts.approvalRecord
      ? ApprovalRecordSchema.parse(artifacts.approvalRecord)
      : undefined;

    if (!approvalRecord || approvalRecord.status !== 'Approved') {
      const currentStatus = approvalRecord?.status ?? 'Draft';
      throw new ApprovalGateError(
        `Specification "${specId}" is in "${currentStatus}" status. Only test cases with status "Approved" can be validated (§3.4, §3.6).`,
        'PRECONDITION_FAILED',
        400,
      );
    }

    const approvedTestCaseIds = approvalRecord.approvedTestCases ?? [];
    if (approvedTestCaseIds.length === 0) {
      throw new ApprovalGateError(
        `Specification "${specId}" has no approved test cases. Approve test cases before validation (§3.4, §3.6).`,
        'NO_APPROVED_TEST_CASES',
        400,
      );
    }

    // Check workspace has scripts for this spec
    const wsFiles = await this.store.listWorkspaceFiles();
    const hasScripts = wsFiles.some(
      (f) =>
        f.endsWith('.spec.ts') &&
        (f.includes(`/${specId}/`) || f.includes(specId) || f.includes('/tests/')),
    );

    if (!hasScripts) {
      throw new ValidationError(
        `No generated scripts found in workspace for specification "${specId}". Run script generation first (POST /api/specs/${specId}/generate-scripts).`,
        'SCRIPTS_NOT_FOUND',
        400,
      );
    }

    const spec: Specification = artifacts.specificationJson
      ? SpecificationSchema.parse(artifacts.specificationJson)
      : {
          specId,
          title: 'Specification',
          businessObjective: '',
          actors: [],
          preconditions: [],
          mainFlow: [],
          alternateFlows: [],
          exceptionFlows: [],
          dataRequirements: [],
          acceptanceCriteria: [],
          nonFunctionalRequirements: [],
          targetApp: 'OrangeHRM',
          environment: 'default',
        };

    const userStory: UserStoryRecord | undefined = artifacts.userStoryJson
      ? UserStoryRecordSchema.parse(artifacts.userStoryJson)
      : undefined;

    const platform: Platform = options?.platform ?? userStory?.platform ?? 'web';
    const targetApp = userStory?.targetApp ?? spec.targetApp ?? 'OrangeHRM';
    const mode = options?.executionMode ?? 'real';

    // Collect test file contents for conformance check
    const testFileContents: { path: string; content: string }[] = [];
    for (const f of wsFiles) {
      if (f.endsWith('.ts')) {
        const c = await this.store.readWorkspaceFile(f);
        if (c !== null) testFileContents.push({ path: f, content: c });
      }
    }

    // 1. Static Validation (§3.6.1)
    let staticResult = await this.staticValidator.validate({ specId });

    // 2. Dynamic Validation (§3.6.2)
    let dynamicResult = await this.dynamicValidator.validate({
      specId,
      platform,
      mode,
    });

    // 3. Conformance Check (§3.6.3)
    let conformanceResult = this.conformanceChecker.check({
      specId,
      approvedTestCaseIds,
      executedTests: dynamicResult.tests,
      testFileContents,
    });

    let overallStatus: ValidationOverallStatus = 'PASSED';
    let healingSummary: HealingSummary | undefined;

    const initialPassed = staticResult.passed && dynamicResult.passed && conformanceResult.passed;

    if (!initialPassed) {
      overallStatus = 'FAILED';

      // 4. Auto-healing with bounded retries (§3.6)
      const shouldAutoHeal = options?.autoHeal !== false;
      const maxAttempts = options?.maxHealAttempts ?? this.getConfig().heal.maxAttempts ?? 3;

      if (shouldAutoHeal && maxAttempts > 0) {
        const healResult = await this.healerAgent.heal({
          specId,
          platform,
          approvedTestCaseIds,
          staticResult,
          dynamicResult,
          conformanceResult,
          provider: options?.provider,
          model: options?.model,
          maxAttempts,
          dynamicMode: mode,
        });

        healingSummary = healResult.summary;

        if (healResult.successful) {
          overallStatus = 'HEALED_PASSED';
          staticResult = healResult.finalStaticResult ?? staticResult;
          dynamicResult = healResult.finalDynamicResult ?? dynamicResult;
          conformanceResult = healResult.finalConformanceResult ?? conformanceResult;
        } else {
          overallStatus = 'FAILED';
          if (healResult.finalStaticResult) staticResult = healResult.finalStaticResult;
          if (healResult.finalDynamicResult) dynamicResult = healResult.finalDynamicResult;
          if (healResult.finalConformanceResult)
            conformanceResult = healResult.finalConformanceResult;
        }
      }
    }

    // SDD Rule: Eligible for promotion if and only if static, dynamic, and conformance all pass
    const eligibleForPromotion =
      staticResult.passed && dynamicResult.passed && conformanceResult.passed;

    // 5. Generate and Save Validation Report (§3.6, §3.7)
    const reportId = `VAL-${specId}-${Date.now()}`;
    const report: ValidationReport = {
      reportId,
      specId,
      timestamp: new Date().toISOString(),
      platform,
      overallStatus,
      eligibleForPromotion,
      staticValidation: staticResult,
      dynamicValidation: dynamicResult,
      conformanceCheck: conformanceResult,
      healingSummary,
      metadata: {
        targetApp,
        environment: spec.environment || 'default',
        provider: options?.provider,
        model: options?.model,
        executionMode: mode,
      },
    };

    await this.store.saveExecutionReport(reportId, report);

    return report;
  }

  /**
   * Directly invokes the Playwright Healer Agent on current workspace scripts (§3.6)
   */
  async heal(specId: string, options?: HealRequest): Promise<HealResponse> {
    const exists = await this.store.specExists(specId);
    if (!exists) {
      throw new ValidationError(`Specification "${specId}" not found.`, 'NOT_FOUND', 404);
    }

    const artifacts = await this.store.readSpecArtifacts(specId);
    const approvalRecord = artifacts?.approvalRecord
      ? ApprovalRecordSchema.parse(artifacts.approvalRecord)
      : undefined;

    const approvedTestCaseIds = approvalRecord?.approvedTestCases ?? [];

    const healResult = await this.healerAgent.heal({
      specId,
      approvedTestCaseIds,
      provider: options?.provider,
      model: options?.model,
      maxAttempts: options?.maxAttempts,
      dynamicMode: 'simulated',
    });

    let latestReport: ValidationReport | undefined;
    if (healResult.successful) {
      // Re-run validation to get fresh report
      latestReport = await this.validate(specId, {
        autoHeal: false,
        executionMode: 'simulated',
      });
    }

    return {
      specId,
      healed: healResult.successful,
      totalAttempts: healResult.summary.totalAttempts,
      healingSummary: healResult.summary,
      latestReport,
    };
  }

  /**
   * Retrieves a specific validation report by ID (§3.7)
   */
  async getReport(reportId: string): Promise<ValidationReport | null> {
    const raw = await this.store.readExecutionReport(reportId);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as ValidationReport;
    } catch {
      return null;
    }
  }

  /**
   * Lists all validation reports, optionally filtered by specId
   */
  async listReports(specId?: string): Promise<ValidationReport[]> {
    const reportIds = await this.store.listExecutionReports();
    const reports: ValidationReport[] = [];

    for (const id of reportIds) {
      if (specId && !id.includes(specId)) continue;

      const report = await this.getReport(id);
      if (report) {
        if (!specId || report.specId === specId) {
          reports.push(report);
        }
      }
    }

    // Sort descending by timestamp
    reports.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return reports;
  }

  /**
   * Retrieves the most recent validation report for a specification
   */
  async getLatestReport(specId: string): Promise<ValidationReport | null> {
    const reports = await this.listReports(specId);
    return reports.length > 0 ? (reports[0] ?? null) : null;
  }
}
