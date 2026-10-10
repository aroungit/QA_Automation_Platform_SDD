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

export const ApprovalRecordSchema = z.object({
  specId: z.string(),
  status: ApprovalStatusSchema,
  reviewer: z.string(),
  comments: z.string(),
  approvedTestCases: z.array(z.string()),
  timestamp: z.string(),
});

export type ApprovalRecord = z.infer<typeof ApprovalRecordSchema>;

export interface SpecArtifactsPayload {
  specId: string;
  userStory?: string;
  userStoryJson?: UserStoryRecord;
  specification?: string;
  specificationJson?: Specification;
  testCases?: string;
  testCasesJson?: TestCase[];
  approvalRecord?: ApprovalRecord;
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
