import type {
  ApiResponse,
  ApprovalDecisionRequest,
  ApprovalLoopbackRequest,
  ApprovalRecord,
  CanProceedResponse,
  GenerateScriptsRequest,
  GenerateScriptsResult,
  HealthResponse,
  HealRequest,
  HealResponse,
  LLMProvidersResponse,
  PromoteSpecRequest,
  PromotionRecord,
  PromotionResult,
  QualityGateEvaluation,
  SpecArtifactsPayload,
  SpecScriptsResponse,
  SpecSummaryItem,
  UserStoryIntakeRequest,
  ValidateSpecRequest,
  ValidationReport,
  WorkspaceFilesResponse,
} from '@qaa/shared';

const API_BASE = '';

export interface LLMRequestHeaders {
  provider?: string;
  model?: string;
}

async function request<T>(
  endpoint: string,
  options?: RequestInit & { llm?: LLMRequestHeaders },
): Promise<T> {
  const url = `${API_BASE}${endpoint}`;

  // Automatically attach active provider/model headers from localStorage if not explicitly supplied
  const storedProvider =
    typeof window !== 'undefined' ? localStorage.getItem('qaa-selected-provider') : null;
  const storedModel =
    typeof window !== 'undefined' ? localStorage.getItem('qaa-selected-model') : null;

  const providerHeader = options?.llm?.provider || storedProvider;
  const modelHeader = options?.llm?.model || storedModel;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(providerHeader ? { 'x-llm-provider': providerHeader } : {}),
    ...(modelHeader ? { 'x-llm-model': modelHeader } : {}),
    ...(options?.headers || {}),
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const body: ApiResponse<T> = await response.json().catch(() => ({
    success: false,
    error: { message: `HTTP ${response.status}: Failed to parse JSON response.` },
  }));

  if (!response.ok || !body.success) {
    const errorMsg = body.error?.message || `HTTP ${response.status} ${response.statusText}`;
    throw new Error(errorMsg);
  }

  return body.data as T;
}

export const api = {
  // Health
  getHealth: () => request<HealthResponse>('/api/health'),

  // Providers (§3.1)
  getProviders: () => request<LLMProvidersResponse>('/api/providers'),

  // Specs & Intake (§3.1, §3.2, §3.3, §3.7)
  listSpecs: () => request<SpecSummaryItem[]>('/api/specs'),
  getSpec: (specId: string) => request<SpecArtifactsPayload>(`/api/specs/${specId}`),

  submitIntake: (payload: UserStoryIntakeRequest, llm?: LLMRequestHeaders) =>
    request<SpecArtifactsPayload>('/api/specs/intake', {
      method: 'POST',
      body: JSON.stringify(payload),
      llm,
    }),

  generateSpec: (specId: string, feedback?: string, llm?: LLMRequestHeaders) =>
    request<SpecArtifactsPayload>(`/api/specs/${specId}/generate-spec`, {
      method: 'POST',
      body: JSON.stringify({ feedback }),
      llm,
    }),

  generateTestCases: (specId: string, feedback?: string, llm?: LLMRequestHeaders) =>
    request<SpecArtifactsPayload>(`/api/specs/${specId}/generate-test-cases`, {
      method: 'POST',
      body: JSON.stringify({ feedback }),
      llm,
    }),

  generateAll: (specId: string, feedback?: string, llm?: LLMRequestHeaders) =>
    request<SpecArtifactsPayload>(`/api/specs/${specId}/generate-all`, {
      method: 'POST',
      body: JSON.stringify({ feedback }),
      llm,
    }),

  // Approval Gate (§3.4)
  getApproval: (specId: string) => request<ApprovalRecord>(`/api/specs/${specId}/approval`),

  submitApprovalDecision: (specId: string, decision: ApprovalDecisionRequest) =>
    request<ApprovalRecord>(`/api/specs/${specId}/approval`, {
      method: 'POST',
      body: JSON.stringify(decision),
    }),

  canProceedToScriptGeneration: (specId: string) =>
    request<CanProceedResponse>(`/api/specs/${specId}/approval/can-proceed`),

  submitLoopback: (specId: string, loopback: ApprovalLoopbackRequest, llm?: LLMRequestHeaders) =>
    request<SpecArtifactsPayload>(`/api/specs/${specId}/approval/loopback`, {
      method: 'POST',
      body: JSON.stringify(loopback),
      llm,
    }),

  // Script Generation & Workspace (§3.5, §3.7)
  generateScripts: (
    specId: string,
    options?: GenerateScriptsRequest,
    llm?: LLMRequestHeaders,
  ) =>
    request<GenerateScriptsResult>(`/api/specs/${specId}/generate-scripts`, {
      method: 'POST',
      body: JSON.stringify(options ?? {}),
      llm,
    }),

  getWorkspaceScripts: (specId: string) =>
    request<SpecScriptsResponse>(`/api/specs/${specId}/scripts`),

  listWorkspaceFiles: (subDir?: string) =>
    request<WorkspaceFilesResponse>(
      subDir ? `/api/workspace/files?subDir=${encodeURIComponent(subDir)}` : '/api/workspace/files',
    ),

  getWorkspaceFile: (filePath: string) =>
    request<{ path: string; content: string }>(
      `/api/workspace/file?path=${encodeURIComponent(filePath)}`,
    ),

  cleanWorkspace: () =>
    request<{ message: string }>('/api/workspace', {
      method: 'DELETE',
    }),

  // Automated Validation & Auto-Healing (§3.6)
  validateSpec: (
    specId: string,
    options?: ValidateSpecRequest,
    llm?: LLMRequestHeaders,
  ) =>
    request<ValidationReport>(`/api/specs/${specId}/validate`, {
      method: 'POST',
      body: JSON.stringify(options ?? {}),
      llm,
    }),

  getValidationReports: (specId: string) =>
    request<ValidationReport[]>(`/api/specs/${specId}/validation-reports`),

  getLatestValidationReport: (specId: string) =>
    request<ValidationReport>(`/api/specs/${specId}/validation-reports/latest`),

  healSpec: (specId: string, options?: HealRequest, llm?: LLMRequestHeaders) =>
    request<HealResponse>(`/api/specs/${specId}/heal`, {
      method: 'POST',
      body: JSON.stringify(options ?? {}),
      llm,
    }),

  // Quality Gates & Repository (§3.7, §8)
  getQualityGate: (specId: string) =>
    request<QualityGateEvaluation>(`/api/specs/${specId}/quality-gate`),
  promoteSpec: (specId: string, options?: PromoteSpecRequest) =>
    request<PromotionResult>(`/api/specs/${specId}/promote`, {
      method: 'POST',
      body: JSON.stringify(options ?? {}),
    }),
  revalidateSpec: (
    specId: string,
    options?: ValidateSpecRequest,
    llm?: LLMRequestHeaders,
  ) =>
    request<ValidationReport>(`/api/specs/${specId}/revalidate`, {
      method: 'POST',
      body: JSON.stringify(options ?? {}),
      llm,
    }),
  getPromotionRecord: (specId: string) =>
    request<PromotionRecord>(`/api/specs/${specId}/promotion`),
  listPromotions: () => request<PromotionRecord[]>('/api/promotions'),
  listAutomationFiles: (platform?: string) =>
    request<{ files: string[]; count: number }>(
      platform ? `/api/automation/files?platform=${platform}` : '/api/automation/files',
    ),
  getAutomationFile: (filePath: string) =>
    request<{ path: string; content: string }>(
      `/api/automation/file?path=${encodeURIComponent(filePath)}`,
    ),

  // Reports (§3.7)
  listReports: (specId?: string) =>
    request<ValidationReport[]>(
      specId ? `/api/specs/${specId}/validation-reports` : '/api/reports/execution-results',
    ),
  getExecutionReport: (reportId: string) =>
    request<ValidationReport>(`/api/reports/execution-results/${reportId}`),
};
