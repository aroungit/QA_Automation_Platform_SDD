import {
  ApprovalRecordSchema,
  SpecificationSchema,
  TestCaseSchema,
  UserStoryIntakeRequestSchema,
  UserStoryRecordSchema,
  type ApprovalRecord,
  type GenerateScriptsRequest,
  type GenerateScriptsResult,
  type HealRequest,
  type HealResponse,
  type PromoteSpecRequest,
  type PromotionRecord,
  type PromotionResult,
  type QualityGateEvaluation,
  type RevalidateSpecRequest,
  type SpecArtifactsPayload,
  type SpecScriptsResponse,
  type SpecSummaryItem,
  type Specification,
  type TestCase,
  type UserStoryInput,
  type UserStoryIntakeRequest,
  type UserStoryRecord,
  type ValidateSpecRequest,
  type ValidationReport,
  type WorkspaceFilesResponse,
} from '@qaa/shared';
import { z } from 'zod';
import type { ProviderRegistry } from '../providers/registry.js';
import type { FileStore, SpecArtifacts } from '../storage/file-store.js';
import { generateSpecId, generateTestCaseId, sanitizeSlug } from '../storage/id-generator.js';
import { ApprovalService } from './approval-service.js';
import {
  formatSpecificationMarkdown,
  formatTestCasesMarkdown,
  formatUserStoryMarkdown,
} from './markdown-formatters.js';
import { QualityGateService } from './quality-gate-service.js';
import { RepositoryService } from './repository-service.js';
import { ScriptGenerator } from './script-generator.js';
import { SpecificationGenerator } from './specification-generator.js';
import { TestCaseGenerator } from './test-case-generator.js';
import { ValidationService } from './validation-service.js';

export interface LLMRequestOptions {
  provider?: string;
  model?: string;
  temperature?: number;
  feedback?: string;
}

export class IntakeService {
  private readonly specGenerator: SpecificationGenerator;
  private readonly tcGenerator: TestCaseGenerator;
  private readonly scriptGenerator: ScriptGenerator;
  private approvalServiceInstance?: ApprovalService;
  private validationServiceInstance?: ValidationService;
  private qualityGateServiceInstance?: QualityGateService;
  private repositoryServiceInstance?: RepositoryService;

  constructor(
    private readonly store: FileStore,
    private readonly registry?: ProviderRegistry,
  ) {
    this.specGenerator = new SpecificationGenerator(this.registry);
    this.tcGenerator = new TestCaseGenerator(this.registry);
    this.scriptGenerator = new ScriptGenerator(this.store, this.registry);
  }

  getApprovalService(): ApprovalService {
    if (!this.approvalServiceInstance) {
      this.approvalServiceInstance = new ApprovalService(this.store, this, this.registry);
    }
    return this.approvalServiceInstance;
  }

  getValidationService(): ValidationService {
    if (!this.validationServiceInstance) {
      this.validationServiceInstance = new ValidationService(this.store, this.registry);
    }
    return this.validationServiceInstance;
  }

  getQualityGateService(): QualityGateService {
    if (!this.qualityGateServiceInstance) {
      this.qualityGateServiceInstance = new QualityGateService(
        this.store,
        this.getValidationService(),
      );
    }
    return this.qualityGateServiceInstance;
  }

  getRepositoryService(): RepositoryService {
    if (!this.repositoryServiceInstance) {
      this.repositoryServiceInstance = new RepositoryService(
        this.store,
        this.getQualityGateService(),
        this.getValidationService(),
      );
    }
    return this.repositoryServiceInstance;
  }

  getScriptGenerator(): ScriptGenerator {
    return this.scriptGenerator;
  }

  async validateSpec(specId: string, options?: ValidateSpecRequest): Promise<ValidationReport> {
    return this.getValidationService().validate(specId, options);
  }

  async healSpec(specId: string, options?: HealRequest): Promise<HealResponse> {
    return this.getValidationService().heal(specId, options);
  }

  async getValidationReport(reportId: string): Promise<ValidationReport | null> {
    return this.getValidationService().getReport(reportId);
  }

  async listValidationReports(specId?: string): Promise<ValidationReport[]> {
    return this.getValidationService().listReports(specId);
  }

  async getLatestValidationReport(specId: string): Promise<ValidationReport | null> {
    return this.getValidationService().getLatestReport(specId);
  }

  async evaluateQualityGates(specId: string): Promise<QualityGateEvaluation> {
    return this.getRepositoryService().evaluateQualityGates(specId);
  }

  async promoteSpec(specId: string, options?: PromoteSpecRequest): Promise<PromotionResult> {
    return this.getRepositoryService().promote(specId, options);
  }

  async getPromotionRecord(specId: string): Promise<PromotionRecord | null> {
    return this.getRepositoryService().getPromotionRecord(specId);
  }

  async listPromotedSpecs(): Promise<PromotionRecord[]> {
    return this.getRepositoryService().listPromotedSpecs();
  }

  async revalidateSpec(specId: string, options?: RevalidateSpecRequest): Promise<ValidationReport> {
    return this.getRepositoryService().revalidate(specId, options);
  }

  async listAutomationFiles(platform?: 'web' | 'mobile'): Promise<string[]> {
    return this.getRepositoryService().listAutomationFiles(platform);
  }

  async readAutomationFile(relPath: string): Promise<string | null> {
    return this.getRepositoryService().readAutomationFile(relPath);
  }

  /**
   * Primary intake endpoint: accepts a User Story and registers a new specification (§3.1)
   */
  async processIntake(
    rawInput: unknown,
    options?: LLMRequestOptions,
  ): Promise<SpecArtifactsPayload> {
    const input: UserStoryIntakeRequest = UserStoryIntakeRequestSchema.parse(rawInput);

    // Derive slug from provided slug or title
    const slugSource = input.slug || input.title.split(/\s+/).slice(0, 2).join('-');
    const slug = sanitizeSlug(slugSource);

    // Get sequence and generate specId (e.g. SPEC-LOGIN-001)
    const sequence = await this.store.getNextSpecSequence(slug);
    const specId = generateSpecId({ slug, sequence });

    const now = new Date().toISOString();
    const userStoryRecord: UserStoryRecord = UserStoryRecordSchema.parse({
      id: specId,
      title: input.title,
      story: input.story,
      acceptanceCriteria: input.acceptanceCriteria,
      priority: input.priority,
      platform: input.platform,
      targetApp: input.targetApp,
      createdAt: now,
      updatedAt: now,
    });

    const userStoryMd = formatUserStoryMarkdown(userStoryRecord);

    // Initial Approval Record in Draft status (§3.4)
    const initialApprovalRecord: ApprovalRecord = ApprovalRecordSchema.parse({
      specId,
      status: 'Draft',
      reviewer: 'System',
      comments: 'Specification created via user story intake',
      approvedTestCases: [],
      timestamp: now,
      history: [
        {
          fromStatus: 'Draft',
          toStatus: 'Draft',
          reviewer: 'System',
          comments: 'Specification created via user story intake',
          approvedTestCases: [],
          timestamp: now,
        },
      ],
    });

    let specRecord: Specification | undefined;
    let specMd: string | undefined;
    let testCases: TestCase[] | undefined;
    let testCasesMd: string | undefined;

    // Optional immediate spec generation (§3.2)
    if (input.generateSpec || input.generateTestCases) {
      specRecord = await this.specGenerator.generate(userStoryRecord, options);
      specMd = formatSpecificationMarkdown(specRecord);
    }

    // Optional immediate test case generation (§3.3)
    if (input.generateTestCases && specRecord) {
      testCases = await this.tcGenerator.generate(specRecord, userStoryRecord, options);
      testCasesMd = formatTestCasesMarkdown(specId, testCases, specRecord.title);
    }

    // Persist all artifacts in /specs/<specId>/ (§3.7)
    await this.store.saveSpecArtifacts(specId, {
      userStory: userStoryMd,
      userStoryJson: userStoryRecord,
      specification: specMd,
      specificationJson: specRecord,
      testCases: testCasesMd,
      testCasesJson: testCases,
      approvalRecord: initialApprovalRecord,
    });

    const artifacts = await this.store.readSpecArtifacts(specId);

    return this.toPayload(specId, artifacts, userStoryRecord, specRecord, testCases);
  }

  /**
   * Generates or regenerates Specification for an existing specId (§3.2)
   */
  async generateSpecification(
    specId: string,
    options?: LLMRequestOptions,
  ): Promise<SpecArtifactsPayload> {
    const artifacts = await this.store.readSpecArtifacts(specId);
    if (!artifacts) {
      throw new Error(`Specification "${specId}" not found.`);
    }

    let userStoryRecord: UserStoryRecord;
    if (artifacts.userStoryJson) {
      userStoryRecord = UserStoryRecordSchema.parse(artifacts.userStoryJson);
    } else if (artifacts.userStory) {
      // Reconstitute from markdown if JSON missing
      userStoryRecord = this.reconstituteStoryFromMd(specId, artifacts.userStory);
    } else {
      throw new Error(`No user story found for "${specId}". Cannot generate specification.`);
    }

    const feedback =
      options?.feedback?.trim() ||
      (['Rejected', 'Needs Clarification'].includes(artifacts.approvalRecord?.status ?? '')
        ? artifacts.approvalRecord?.comments
        : undefined);

    const mergedOptions: LLMRequestOptions = {
      ...options,
      feedback: feedback || undefined,
    };

    const specRecord = await this.specGenerator.generate(userStoryRecord, mergedOptions);
    const specMd = formatSpecificationMarkdown(specRecord);

    await this.store.saveSpecArtifacts(specId, {
      specification: specMd,
      specificationJson: specRecord,
    });

    await this.getApprovalService().handleArtifactUpdate(
      specId,
      'Specification was regenerated' + (feedback ? ` with feedback: "${feedback}"` : ''),
    );
    await this.getRepositoryService().handleSpecChanged(specId, 'Specification regenerated');

    const updated = await this.store.readSpecArtifacts(specId);
    return this.toPayload(specId, updated, userStoryRecord, specRecord);
  }

  /**
   * Generates or regenerates Test Cases from the specification (§3.3)
   */
  async generateTestCases(
    specId: string,
    options?: LLMRequestOptions,
  ): Promise<SpecArtifactsPayload> {
    const artifacts = await this.store.readSpecArtifacts(specId);
    if (!artifacts) {
      throw new Error(`Specification "${specId}" not found.`);
    }

    if (!artifacts.specificationJson) {
      throw new Error(
        `Specification for "${specId}" does not exist yet. Please generate the specification before test cases.`,
      );
    }

    const specRecord = SpecificationSchema.parse(artifacts.specificationJson);
    const userStoryRecord = artifacts.userStoryJson
      ? UserStoryRecordSchema.parse(artifacts.userStoryJson)
      : undefined;

    const feedback =
      options?.feedback?.trim() ||
      (['Rejected', 'Needs Clarification'].includes(artifacts.approvalRecord?.status ?? '')
        ? artifacts.approvalRecord?.comments
        : undefined);

    const mergedOptions: LLMRequestOptions = {
      ...options,
      feedback: feedback || undefined,
    };

    const testCases = await this.tcGenerator.generate(specRecord, userStoryRecord, mergedOptions);
    const testCasesMd = formatTestCasesMarkdown(specId, testCases, specRecord.title);

    await this.store.saveSpecArtifacts(specId, {
      testCases: testCasesMd,
      testCasesJson: testCases,
    });

    await this.getApprovalService().handleArtifactUpdate(
      specId,
      'Test cases were regenerated' + (feedback ? ` with feedback: "${feedback}"` : ''),
    );
    await this.getRepositoryService().handleSpecChanged(specId, 'Test cases regenerated');

    const updated = await this.store.readSpecArtifacts(specId);
    return this.toPayload(specId, updated, userStoryRecord, specRecord, testCases);
  }

  /**
   * Generates both Specification and Test Cases sequentially
   */
  async generateAll(specId: string, options?: LLMRequestOptions): Promise<SpecArtifactsPayload> {
    await this.generateSpecification(specId, options);
    return await this.generateTestCases(specId, options);
  }

  /**
   * Retrieves full details and artifacts for a specification
   */
  async getSpec(specId: string): Promise<SpecArtifactsPayload | null> {
    const artifacts = await this.store.readSpecArtifacts(specId);
    if (!artifacts) {
      return null;
    }
    return this.toPayload(specId, artifacts);
  }

  /**
   * Lists all specifications with summary metadata
   */
  async listSpecs(): Promise<SpecSummaryItem[]> {
    const summaries = await this.store.listSpecs();
    return summaries.map((s) => ({
      specId: s.specId,
      title: s.title,
      status: s.status,
      hasUserStory: s.hasUserStory,
      hasSpecification: s.hasSpecification,
      hasTestCases: s.hasTestCases,
      hasApprovalRecord: s.hasApprovalRecord,
      testCaseCount: s.testCaseCount,
      targetApp: s.targetApp,
      platform: s.platform,
      priority: s.priority,
      promoted: s.promoted,
      revalidationRequired: s.revalidationRequired,
      updatedAt: s.updatedAt,
    }));
  }

  /**
   * Updates user story data directly
   */
  async updateUserStory(
    specId: string,
    updates: Partial<UserStoryInput>,
  ): Promise<SpecArtifactsPayload> {
    const artifacts = await this.store.readSpecArtifacts(specId);
    if (!artifacts) {
      throw new Error(`Specification "${specId}" not found.`);
    }

    let existingRecord: UserStoryRecord;
    if (artifacts.userStoryJson) {
      existingRecord = UserStoryRecordSchema.parse(artifacts.userStoryJson);
    } else {
      existingRecord = this.reconstituteStoryFromMd(specId, artifacts.userStory || '');
    }

    const updatedRecord: UserStoryRecord = UserStoryRecordSchema.parse({
      ...existingRecord,
      ...updates,
      id: specId,
      updatedAt: new Date().toISOString(),
    });

    const userStoryMd = formatUserStoryMarkdown(updatedRecord);

    await this.store.saveSpecArtifacts(specId, {
      userStory: userStoryMd,
      userStoryJson: updatedRecord,
    });

    await this.getApprovalService().handleArtifactUpdate(specId, 'User story was updated');
    await this.getRepositoryService().handleSpecChanged(specId, 'User story updated');

    const updated = await this.store.readSpecArtifacts(specId);
    return this.toPayload(specId, updated, updatedRecord);
  }

  /**
   * Manually sets or updates specification content
   */
  async updateSpecification(specId: string, spec: unknown): Promise<SpecArtifactsPayload> {
    const validatedSpec = SpecificationSchema.parse({
      ...(spec as object),
      specId,
    });

    const specMd = formatSpecificationMarkdown(validatedSpec);

    await this.store.saveSpecArtifacts(specId, {
      specification: specMd,
      specificationJson: validatedSpec,
    });

    await this.getApprovalService().handleArtifactUpdate(
      specId,
      'Specification was manually updated',
    );
    await this.getRepositoryService().handleSpecChanged(specId, 'Specification manually updated');

    const updated = await this.store.readSpecArtifacts(specId);
    return this.toPayload(specId, updated, undefined, validatedSpec);
  }

  /**
   * Manually sets or updates test cases
   */
  async updateTestCases(specId: string, testCasesInput: unknown): Promise<SpecArtifactsPayload> {
    const rawArray = z.array(TestCaseSchema).parse(testCasesInput);
    const normalized = rawArray.map((tc, idx) => ({
      ...tc,
      id: tc.id || generateTestCaseId(specId, idx + 1),
      specId,
    }));

    const validatedTestCases = z.array(TestCaseSchema).parse(normalized);
    const testCasesMd = formatTestCasesMarkdown(specId, validatedTestCases);

    await this.store.saveSpecArtifacts(specId, {
      testCases: testCasesMd,
      testCasesJson: validatedTestCases,
    });

    await this.getApprovalService().handleArtifactUpdate(
      specId,
      'Test cases were manually updated',
    );
    await this.getRepositoryService().handleSpecChanged(specId, 'Test cases manually updated');

    const updated = await this.store.readSpecArtifacts(specId);
    return this.toPayload(specId, updated, undefined, undefined, validatedTestCases);
  }

  /**
   * Deletes a specification and its folder
   */
  async deleteSpec(specId: string): Promise<boolean> {
    return this.store.deleteSpec(specId);
  }

  /**
   * Generates Playwright automation scripts for approved test cases (§3.5)
   */
  async generateScripts(
    specId: string,
    request?: GenerateScriptsRequest,
  ): Promise<GenerateScriptsResult> {
    return this.scriptGenerator.generate(specId, request);
  }

  /**
   * Reads all workspace script files relevant to the specification (§3.5)
   */
  async getWorkspaceScripts(specId: string): Promise<SpecScriptsResponse> {
    const allFiles = await this.store.listWorkspaceFiles();
    const files: { path: string; content: string }[] = [];

    for (const relPath of allFiles) {
      if (
        relPath.includes(specId) ||
        relPath.endsWith('.config.ts') ||
        relPath.endsWith('tsconfig.json') ||
        relPath.includes('/pages/') ||
        relPath.includes('/fixtures/') ||
        relPath.includes('/utils/')
      ) {
        const content = await this.store.readWorkspaceFile(relPath);
        if (content !== null) {
          files.push({ path: relPath, content });
        }
      }
    }

    return {
      specId,
      files,
    };
  }

  /**
   * Lists all files in the temporary workspace (.workspace)
   */
  async listWorkspaceFiles(subDir = ''): Promise<WorkspaceFilesResponse> {
    const files = await this.store.listWorkspaceFiles(subDir);
    return {
      files,
      workspaceDir: this.store.tempWorkspaceDir,
    };
  }

  /**
   * Reads a file from the temporary workspace (.workspace)
   */
  async readWorkspaceFile(relPath: string): Promise<string | null> {
    return this.store.readWorkspaceFile(relPath);
  }

  /**
   * Cleans the temporary workspace (.workspace)
   */
  async cleanWorkspace(): Promise<void> {
    await this.store.cleanWorkspace();
  }

  private toPayload(
    specId: string,
    artifacts: SpecArtifacts | null,
    storyRecord?: UserStoryRecord,
    specRecord?: Specification,
    testCases?: TestCase[],
  ): SpecArtifactsPayload {
    return {
      specId,
      userStory: artifacts?.userStory,
      userStoryJson:
        storyRecord ??
        (artifacts?.userStoryJson
          ? (UserStoryRecordSchema.safeParse(artifacts.userStoryJson).data ?? undefined)
          : undefined),
      specification: artifacts?.specification,
      specificationJson:
        specRecord ??
        (artifacts?.specificationJson
          ? (SpecificationSchema.safeParse(artifacts.specificationJson).data ?? undefined)
          : undefined),
      testCases: artifacts?.testCases,
      testCasesJson:
        testCases ??
        (artifacts?.testCasesJson
          ? (z.array(TestCaseSchema).safeParse(artifacts.testCasesJson).data ?? undefined)
          : undefined),
      approvalRecord: artifacts?.approvalRecord,
      promotionRecord: artifacts?.promotionRecord,
      files: artifacts?.files ?? [],
    };
  }

  private reconstituteStoryFromMd(specId: string, md: string): UserStoryRecord {
    const now = new Date().toISOString();
    return {
      id: specId,
      title: `Story for ${specId}`,
      story: md,
      acceptanceCriteria: ['Must meet described criteria'],
      priority: 'medium',
      platform: 'web',
      targetApp: 'OrangeHRM',
      createdAt: now,
      updatedAt: now,
    };
  }
}
