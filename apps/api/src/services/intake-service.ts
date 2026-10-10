import {
  ApprovalRecordSchema,
  SpecificationSchema,
  TestCaseSchema,
  UserStoryIntakeRequestSchema,
  UserStoryRecordSchema,
  type ApprovalRecord,
  type SpecArtifactsPayload,
  type SpecSummaryItem,
  type Specification,
  type TestCase,
  type UserStoryInput,
  type UserStoryIntakeRequest,
  type UserStoryRecord,
} from '@qaa/shared';
import { z } from 'zod';
import type { ProviderRegistry } from '../providers/registry.js';
import type { FileStore, SpecArtifacts } from '../storage/file-store.js';
import { generateSpecId, generateTestCaseId, sanitizeSlug } from '../storage/id-generator.js';
import {
  formatSpecificationMarkdown,
  formatTestCasesMarkdown,
  formatUserStoryMarkdown,
} from './markdown-formatters.js';
import { SpecificationGenerator } from './specification-generator.js';
import { TestCaseGenerator } from './test-case-generator.js';

export interface LLMRequestOptions {
  provider?: string;
  model?: string;
  temperature?: number;
}

export class IntakeService {
  private readonly specGenerator: SpecificationGenerator;
  private readonly tcGenerator: TestCaseGenerator;

  constructor(
    private readonly store: FileStore,
    private readonly registry?: ProviderRegistry,
  ) {
    this.specGenerator = new SpecificationGenerator(this.registry);
    this.tcGenerator = new TestCaseGenerator(this.registry);
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

    const specRecord = await this.specGenerator.generate(userStoryRecord, options);
    const specMd = formatSpecificationMarkdown(specRecord);

    await this.store.saveSpecArtifacts(specId, {
      specification: specMd,
      specificationJson: specRecord,
    });

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

    const testCases = await this.tcGenerator.generate(specRecord, userStoryRecord, options);
    const testCasesMd = formatTestCasesMarkdown(specId, testCases, specRecord.title);

    await this.store.saveSpecArtifacts(specId, {
      testCases: testCasesMd,
      testCasesJson: testCases,
    });

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

    const updated = await this.store.readSpecArtifacts(specId);
    return this.toPayload(specId, updated, undefined, undefined, validatedTestCases);
  }

  /**
   * Deletes a specification and its folder
   */
  async deleteSpec(specId: string): Promise<boolean> {
    return this.store.deleteSpec(specId);
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
