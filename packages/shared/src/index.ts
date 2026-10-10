import { z } from 'zod';

// ==========================================
// LLM Provider Types & Schemas
// ==========================================

export const LLM_PROVIDERS = ['groq', 'cohere', 'openrouter'] as const;
export type LLMProviderName = (typeof LLM_PROVIDERS)[number];

export const LLMProviderNameSchema = z.enum(LLM_PROVIDERS);

export interface LLMProviderInfo {
  name: LLMProviderName;
  displayName: string;
  defaultModel: string;
  models: string[];
  configured: boolean;
}

export interface LLMProvidersResponse {
  defaultProvider: LLMProviderName;
  providers: LLMProviderInfo[];
}

export interface GenerateOptions {
  provider?: LLMProviderName;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

export interface GenerateResult {
  text: string;
  provider: LLMProviderName;
  model: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

// ==========================================
// Platform, Priority & Lifecycle Constants
// ==========================================

export const PLATFORMS = ['web', 'mobile', 'both'] as const;
export type Platform = (typeof PLATFORMS)[number];
export const PlatformSchema = z.enum(PLATFORMS);

export const PRIORITIES = ['critical', 'high', 'medium', 'low'] as const;
export type Priority = (typeof PRIORITIES)[number];
export const PrioritySchema = z.enum(PRIORITIES);

export const APPROVAL_STATUSES = [
  'Draft',
  'Under Review',
  'Approved',
  'Rejected',
  'Needs Clarification',
] as const;
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];
export const ApprovalStatusSchema = z.enum(APPROVAL_STATUSES);

export const AUTOMATION_SUITABILITIES = [
  'automatable',
  'manual-only',
  'needs-clarification',
] as const;
export type AutomationSuitability = (typeof AUTOMATION_SUITABILITIES)[number];
export const AutomationSuitabilitySchema = z.enum(AUTOMATION_SUITABILITIES);

export const TEST_TYPES = [
  'functional',
  'negative',
  'boundary',
  'regression',
  'accessibility',
  'smoke',
] as const;
export type TestType = (typeof TEST_TYPES)[number];
export const TestTypeSchema = z.enum(TEST_TYPES);

// ==========================================
// Spec-Driven Artifact Schemas
// ==========================================

export const UserStoryInputSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  story: z.string().min(1, 'User story description is required'),
  acceptanceCriteria: z
    .array(z.string().min(1))
    .min(1, 'At least one acceptance criterion is required'),
  priority: PrioritySchema.default('medium'),
  platform: PlatformSchema.default('web'),
  targetApp: z.string().default('OrangeHRM'),
});

export type UserStoryInput = z.infer<typeof UserStoryInputSchema>;

export const UserStoryIntakeRequestSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  story: z.string().min(1, 'User story description is required'),
  acceptanceCriteria: z
    .array(z.string().min(1))
    .min(1, 'At least one acceptance criterion is required'),
  priority: PrioritySchema.default('medium'),
  platform: PlatformSchema.default('web'),
  targetApp: z.string().default('OrangeHRM'),
  slug: z.string().optional(),
  generateSpec: z.boolean().default(false),
  generateTestCases: z.boolean().default(false),
});

export type UserStoryIntakeRequest = z.infer<typeof UserStoryIntakeRequestSchema>;

export const UserStoryRecordSchema = UserStoryInputSchema.extend({
  id: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type UserStoryRecord = z.infer<typeof UserStoryRecordSchema>;

export const FlowStepSchema = z.object({
  step: z.number().int().positive(),
  action: z.string().min(1),
  expected: z.string().min(1),
});

export const SpecificationSchema = z.object({
  specId: z.string(),
  title: z.string(),
  businessObjective: z.string(),
  actors: z.array(z.string()),
  preconditions: z.array(z.string()),
  mainFlow: z.array(FlowStepSchema),
  alternateFlows: z.array(
    z.object({
      name: z.string(),
      steps: z.array(z.string()),
    }),
  ),
  exceptionFlows: z.array(
    z.object({
      name: z.string(),
      condition: z.string(),
      action: z.string(),
    }),
  ),
  dataRequirements: z.array(
    z.object({
      field: z.string(),
      type: z.string(),
      rules: z.string(),
    }),
  ),
  acceptanceCriteria: z.array(z.string()),
  nonFunctionalRequirements: z.array(z.string()).default([]),
  targetApp: z.string(),
  environment: z.string().default('default'),
});

export type Specification = z.infer<typeof SpecificationSchema>;

export const TestCaseStepSchema = z.object({
  stepNumber: z.number().int().positive(),
  action: z.string().min(1),
  expectedResult: z.string().min(1),
});

export const TestCaseSchema = z.object({
  id: z.string(),
  specId: z.string(),
  title: z.string(),
  preconditions: z.array(z.string()),
  testSteps: z.array(TestCaseStepSchema),
  expectedResults: z.array(z.string()),
  priority: PrioritySchema,
  testType: TestTypeSchema,
  targetPlatform: PlatformSchema,
  automationSuitability: AutomationSuitabilitySchema,
});

export type TestCase = z.infer<typeof TestCaseSchema>;

export const ApprovalHistoryEntrySchema = z.object({
  fromStatus: ApprovalStatusSchema,
  toStatus: ApprovalStatusSchema,
  reviewer: z.string(),
  comments: z.string(),
  approvedTestCases: z.array(z.string()).default([]),
  timestamp: z.string(),
});

export type ApprovalHistoryEntry = z.infer<typeof ApprovalHistoryEntrySchema>;

export const ApprovalRecordSchema = z.object({
  specId: z.string(),
  status: ApprovalStatusSchema,
  reviewer: z.string(),
  comments: z.string(),
  approvedTestCases: z.array(z.string()),
  timestamp: z.string(),
  history: z.array(ApprovalHistoryEntrySchema).optional(),
});

export type ApprovalRecord = z.infer<typeof ApprovalRecordSchema>;

export const ApprovalDecisionRequestSchema = z.object({
  status: ApprovalStatusSchema,
  reviewer: z.string().min(1, 'Reviewer is required'),
  comments: z.string().optional().default(''),
  approvedTestCases: z.array(z.string()).optional(),
});

export type ApprovalDecisionRequest = z.infer<typeof ApprovalDecisionRequestSchema>;

export const LoopbackStageSchema = z.enum(['spec', 'test-cases', 'all']);
export type LoopbackStage = z.infer<typeof LoopbackStageSchema>;

export const ApprovalLoopbackRequestSchema = z.object({
  stage: LoopbackStageSchema.default('all'),
  feedback: z.string().optional(),
  targetStatus: ApprovalStatusSchema.default('Draft'),
});

export type ApprovalLoopbackRequest = z.infer<typeof ApprovalLoopbackRequestSchema>;

export interface CanProceedResponse {
  canProceed: boolean;
  status: ApprovalStatus;
  approvedTestCases: string[];
  totalTestCases: number;
  reason?: string;
}

export interface SpecArtifactsPayload {
  specId: string;
  userStory?: string;
  userStoryJson?: UserStoryRecord;
  specification?: string;
  specificationJson?: Specification;
  testCases?: string;
  testCasesJson?: TestCase[];
  approvalRecord?: ApprovalRecord;
  promotionRecord?: PromotionRecord;
  files: string[];
}

export interface SpecSummaryItem {
  specId: string;
  title?: string;
  status: string;
  hasUserStory: boolean;
  hasSpecification: boolean;
  hasTestCases: boolean;
  hasApprovalRecord: boolean;
  testCaseCount?: number;
  targetApp?: string;
  platform?: string;
  priority?: string;
  promoted?: boolean;
  revalidationRequired?: boolean;
  updatedAt: string;
}

// ==========================================
// API Response & Envelope Types
// ==========================================

export interface ApiErrorPayload {
  message: string;
  code?: string;
  details?: unknown;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiErrorPayload;
}

export interface HealthResponse {
  status: 'ok';
  name: string;
  version: string;
  uptime: number;
  timestamp: string;
}

// ==========================================
// Playwright Script Generation (§3.5)
// ==========================================

export const SCRIPT_CATEGORIES = ['page', 'test', 'fixture', 'util', 'config'] as const;
export type ScriptCategory = (typeof SCRIPT_CATEGORIES)[number];
export const ScriptCategorySchema = z.enum(SCRIPT_CATEGORIES);

export const GeneratedScriptFileSchema = z.object({
  path: z.string(),
  content: z.string(),
  category: ScriptCategorySchema,
  platform: z.enum(['web', 'mobile', 'shared']),
  specId: z.string().optional(),
  testCaseId: z.string().optional(),
});

export type GeneratedScriptFile = z.infer<typeof GeneratedScriptFileSchema>;

export const GenerateScriptsRequestSchema = z.object({
  testCaseIds: z.array(z.string()).optional(),
  targetPlatform: PlatformSchema.optional(),
  cleanWorkspace: z.boolean().optional().default(false),
  provider: LLMProviderNameSchema.optional(),
  model: z.string().optional(),
});

export type GenerateScriptsInput = z.input<typeof GenerateScriptsRequestSchema>;
export type GenerateScriptsRequest = GenerateScriptsInput;

export interface GeneratedFileInfo {
  path: string;
  category: ScriptCategory;
  platform: 'web' | 'mobile' | 'shared';
  size: number;
}

export interface GenerateScriptsResult {
  specId: string;
  targetApp: string;
  platform: Platform;
  approvedTestCases: string[];
  generatedFiles: GeneratedFileInfo[];
  workspaceDir: string;
  configFiles: string[];
  timestamp: string;
}

export interface WorkspaceFilesResponse {
  files: string[];
  workspaceDir: string;
}

export interface SpecScriptsResponse {
  specId: string;
  files: {
    path: string;
    content: string;
  }[];
}

// ==========================================
// Automated Validation & Auto-Heal (§3.6)
// ==========================================

export const VALIDATION_OVERALL_STATUSES = ['PASSED', 'FAILED', 'HEALED_PASSED'] as const;
export type ValidationOverallStatus = (typeof VALIDATION_OVERALL_STATUSES)[number];
export const ValidationOverallStatusSchema = z.enum(VALIDATION_OVERALL_STATUSES);

export const DYNAMIC_EXECUTION_MODES = ['real', 'simulated', 'dry-run'] as const;
export type DynamicExecutionMode = (typeof DYNAMIC_EXECUTION_MODES)[number];
export const DynamicExecutionModeSchema = z.enum(DYNAMIC_EXECUTION_MODES);

export interface StaticValidationResult {
  passed: boolean;
  typeScriptCheck: {
    passed: boolean;
    errors: string[];
  };
  lintCheck: {
    passed: boolean;
    errors: string[];
    warnings: string[];
  };
  selectorValidation: {
    passed: boolean;
    validCount: number;
    warnings: string[];
    locatorsFound: string[];
  };
  importValidation: {
    passed: boolean;
    errors: string[];
    imports: string[];
  };
}

export interface TestCaseExecutionResult {
  testCaseId: string;
  title: string;
  status: 'passed' | 'failed' | 'timedOut' | 'skipped';
  durationMs: number;
  error?: string;
  stack?: string;
  screenshotUrl?: string;
  traceUrl?: string;
  consoleLogs?: string[];
}

export interface DynamicValidationResult {
  passed: boolean;
  executed: boolean;
  totalTests: number;
  passedCount: number;
  failedCount: number;
  skippedCount: number;
  durationMs: number;
  mode: DynamicExecutionMode;
  tests: TestCaseExecutionResult[];
  artifacts: {
    screenshots: string[];
    traces: string[];
    reports: string[];
  };
  error?: string;
}

export interface ConformanceCheckResult {
  passed: boolean;
  approvedTestCaseIds: string[];
  executedTestCaseIds: string[];
  covered: string[];
  missing: string[];
  unmapped: string[];
  failedTests: string[];
  details: string[];
}

export interface HealChangeApplied {
  file: string;
  description: string;
  diff?: string;
}

export interface HealAttempt {
  attemptNumber: number;
  timestamp: string;
  stage: 'static' | 'dynamic' | 'conformance';
  diagnosis: string;
  targetFiles: string[];
  changesApplied: HealChangeApplied[];
  success: boolean;
}

export interface HealingSummary {
  attempted: boolean;
  totalAttempts: number;
  maxAttempts: number;
  successful: boolean;
  attempts: HealAttempt[];
}

export interface ValidationReport {
  reportId: string;
  specId: string;
  timestamp: string;
  platform: Platform;
  overallStatus: ValidationOverallStatus;
  eligibleForPromotion: boolean;
  staticValidation: StaticValidationResult;
  dynamicValidation: DynamicValidationResult;
  conformanceCheck: ConformanceCheckResult;
  healingSummary?: HealingSummary;
  metadata: {
    targetApp: string;
    environment?: string;
    provider?: string;
    model?: string;
    executionMode?: DynamicExecutionMode;
  };
}

export const ValidateSpecRequestSchema = z.object({
  autoHeal: z.boolean().optional().default(true),
  maxHealAttempts: z.number().int().nonnegative().optional(),
  executionMode: DynamicExecutionModeSchema.optional().default('real'),
  platform: PlatformSchema.optional(),
  provider: LLMProviderNameSchema.optional(),
  model: z.string().optional(),
});

export type ValidateSpecInput = z.input<typeof ValidateSpecRequestSchema>;
export type ValidateSpecRequest = ValidateSpecInput;

export const HealRequestSchema = z.object({
  maxAttempts: z.number().int().positive().optional(),
  targetFiles: z.array(z.string()).optional(),
  provider: LLMProviderNameSchema.optional(),
  model: z.string().optional(),
  reason: z.string().optional(),
});

export type HealInput = z.input<typeof HealRequestSchema>;
export type HealRequest = HealInput;

export interface HealResponse {
  specId: string;
  healed: boolean;
  totalAttempts: number;
  healingSummary: HealingSummary;
  latestReport?: ValidationReport;
}

// ==========================================
// Quality Gates & Repository Service (§3.7, §8)
// ==========================================

export const QUALITY_GATE_KEYS = [
  'APPROVED_SPECIFICATION',
  'APPROVED_TEST_CASES',
  'SCRIPTS_MAP_TO_APPROVED_TEST_CASES',
  'SCRIPTS_COMPILE_SUCCESSFULLY',
  'SCRIPTS_PASS_AUTOMATED_EXECUTION',
  'EXECUTION_EVIDENCE_STORED',
  'NO_UNAPPROVED_FUNCTIONALITY_AUTOMATED',
  'SPEC_UP_TO_DATE_NO_REVALIDATION_REQUIRED',
] as const;

export type QualityGateKey = (typeof QUALITY_GATE_KEYS)[number];
export const QualityGateKeySchema = z.enum(QUALITY_GATE_KEYS);

export const QualityGateItemSchema = z.object({
  gate: QualityGateKeySchema,
  passed: z.boolean(),
  name: z.string(),
  description: z.string(),
  details: z.string().optional(),
});

export type QualityGateItem = z.infer<typeof QualityGateItemSchema>;

export const QualityGateEvaluationSchema = z.object({
  specId: z.string(),
  passed: z.boolean(),
  status: z.enum(['PASSED', 'FAILED']),
  gates: z.array(QualityGateItemSchema),
  validationReportId: z.string().optional(),
  revalidationRequired: z.boolean(),
  promoted: z.boolean(),
  promotedAt: z.string().optional(),
  evaluatedAt: z.string(),
});

export type QualityGateEvaluation = z.infer<typeof QualityGateEvaluationSchema>;

export const PromotedFileInfoSchema = z.object({
  sourcePath: z.string(),
  targetPath: z.string(),
  category: z.string(),
  platform: z.enum(['web', 'mobile', 'shared']),
  size: z.number(),
});

export type PromotedFileInfo = z.infer<typeof PromotedFileInfoSchema>;

export const GitCommitInfoSchema = z.object({
  sha: z.string().optional(),
  message: z.string(),
  committedFiles: z.array(z.string()),
  timestamp: z.string(),
  author: z.string().optional(),
});

export type GitCommitInfo = z.infer<typeof GitCommitInfoSchema>;

export const PromotionRecordSchema = z.object({
  specId: z.string(),
  promotedAt: z.string(),
  validationReportId: z.string(),
  status: z.enum(['promoted', 'outdated']),
  revalidationRequired: z.boolean(),
  promotedFiles: z.array(PromotedFileInfoSchema),
  commit: GitCommitInfoSchema.optional(),
  metadata: z
    .object({
      platform: PlatformSchema.optional(),
      targetApp: z.string().optional(),
      reviewer: z.string().optional(),
    })
    .optional(),
});

export type PromotionRecord = z.infer<typeof PromotionRecordSchema>;

export const PromoteSpecRequestSchema = z.object({
  commitMessage: z.string().optional(),
  autoCommit: z.boolean().optional().default(true),
  authorName: z.string().optional(),
  authorEmail: z.string().optional(),
});

export type PromoteSpecRequest = z.infer<typeof PromoteSpecRequestSchema>;

export const PromotionResultSchema = z.object({
  success: z.boolean(),
  specId: z.string(),
  promotedAt: z.string(),
  validationReportId: z.string(),
  promotedFiles: z.array(PromotedFileInfoSchema),
  commit: GitCommitInfoSchema.optional(),
  qualityGateEvaluation: QualityGateEvaluationSchema,
});

export type PromotionResult = z.infer<typeof PromotionResultSchema>;

export const RevalidateSpecRequestSchema = z.object({
  autoHeal: z.boolean().optional().default(true),
  maxHealAttempts: z.number().int().nonnegative().optional(),
  executionMode: DynamicExecutionModeSchema.optional().default('real'),
  platform: PlatformSchema.optional(),
  provider: LLMProviderNameSchema.optional(),
  model: z.string().optional(),
});

export type RevalidateSpecInput = z.input<typeof RevalidateSpecRequestSchema>;
export type RevalidateSpecRequest = RevalidateSpecInput;
