import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock matchMedia for jsdom
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock fetch for API calls in test environment
globalThis.fetch = vi.fn().mockImplementation((input: RequestInfo | URL) => {
  const urlStr = typeof input === 'string' ? input : input.toString();

  if (urlStr.includes('/api/providers')) {
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          success: true,
          data: {
            defaultProvider: 'groq',
            providers: [
              {
                name: 'groq',
                displayName: 'Groq',
                defaultModel: 'llama-3.3-70b-versatile',
                models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'],
                configured: true,
              },
              {
                name: 'cohere',
                displayName: 'Cohere',
                defaultModel: 'command-r-plus',
                models: ['command-r-plus', 'command-r'],
                configured: true,
              },
              {
                name: 'openrouter',
                displayName: 'OpenRouter',
                defaultModel: 'openai/gpt-4o-mini',
                models: ['openai/gpt-4o-mini'],
                configured: true,
              },
            ],
          },
        }),
    } as Response);
  }

  if (urlStr.includes('/api/health')) {
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          success: true,
          data: {
            status: 'ok',
            name: 'QA_Automation_Platform_Agent',
            version: '0.1.0',
            uptime: 100,
            timestamp: new Date().toISOString(),
          },
        }),
    } as Response);
  }

  if (
    urlStr.includes('/api/specs/intake') ||
    urlStr.includes('/api/specs/SPEC-LOGIN-001/generate')
  ) {
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          success: true,
          data: {
            specId: 'SPEC-LOGIN-001',
            userStoryJson: {
              id: 'SPEC-LOGIN-001',
              title: 'Admin Authentication',
              story: 'As an Admin, I want to log in...',
              acceptanceCriteria: ['Valid credentials redirect to dashboard'],
              priority: 'high',
              platform: 'web',
              targetApp: 'OrangeHRM',
              createdAt: '2026-10-10T00:00:00.000Z',
              updatedAt: '2026-10-10T00:00:00.000Z',
            },
            specification: '# Specification\n\n## Business Objective\nVerify secure authentication',
            specificationJson: {
              specId: 'SPEC-LOGIN-001',
              title: 'Admin Authentication Specification',
              businessObjective: 'Verify secure authentication of admin users.',
              actors: ['Administrator'],
              preconditions: ['Browser open on login page'],
              mainFlow: [
                { step: 1, action: 'Enter credentials', expected: 'Form filled' },
                { step: 2, action: 'Submit', expected: 'Redirected to Dashboard' },
              ],
              alternateFlows: [],
              exceptionFlows: [
                { name: 'Invalid Credentials', condition: 'Wrong password', action: 'Show error' },
              ],
              dataRequirements: [{ field: 'username', type: 'string', rules: 'Required' }],
              acceptanceCriteria: ['Valid credentials redirect to dashboard'],
              nonFunctionalRequirements: ['Response time under 2s'],
              targetApp: 'OrangeHRM',
              environment: 'staging',
            },
            testCasesJson: [
              {
                id: 'TC-LOGIN-001',
                specId: 'SPEC-LOGIN-001',
                title: 'Successful Admin Login',
                preconditions: ['OrangeHRM login page accessible'],
                testSteps: [
                  {
                    stepNumber: 1,
                    action: 'Enter credentials',
                    expectedResult: 'Fields populated',
                  },
                  { stepNumber: 2, action: 'Click Login', expectedResult: 'Dashboard page loaded' },
                ],
                expectedResults: ['User authenticated', 'Dashboard visible'],
                priority: 'high',
                testType: 'functional',
                targetPlatform: 'web',
                automationSuitability: 'automatable',
              },
            ],
            approvalRecord: {
              specId: 'SPEC-LOGIN-001',
              status: 'Under Review',
              reviewer: 'System',
              comments: 'Intake completed',
              approvedTestCases: [],
              timestamp: '2026-10-10T00:00:00.000Z',
            },
            files: ['user-story.md', 'specification.md', 'test-cases.md', 'approval-record.json'],
          },
        }),
    } as Response);
  }

  if (urlStr.includes('/approval/can-proceed')) {
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          success: true,
          data: {
            canProceed: false,
            status: 'Under Review',
            approvedTestCases: [],
            totalTestCases: 1,
            reason: 'Spec must be Approved with at least 1 approved test case',
          },
        }),
    } as Response);
  }

  if (urlStr.includes('/approval/loopback')) {
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          success: true,
          data: {
            specId: 'SPEC-LOGIN-001',
            approvalRecord: {
              specId: 'SPEC-LOGIN-001',
              status: 'Draft',
              reviewer: 'System',
              comments: 'Loopback executed',
              approvedTestCases: [],
              timestamp: '2026-10-10T00:00:00.000Z',
            },
            files: ['user-story.md', 'specification.md', 'test-cases.md', 'approval-record.json'],
          },
        }),
    } as Response);
  }

  if (urlStr.includes('/approval')) {
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          success: true,
          data: {
            specId: 'SPEC-LOGIN-001',
            status: 'Under Review',
            reviewer: 'System',
            comments: 'Ready for evaluation',
            approvedTestCases: [],
            timestamp: '2026-10-10T00:00:00.000Z',
            history: [
              {
                fromStatus: 'Draft',
                toStatus: 'Under Review',
                reviewer: 'QA Lead',
                comments: 'Ready for evaluation',
                approvedTestCases: [],
                timestamp: '2026-10-10T00:00:00.000Z',
              },
            ],
          },
        }),
    } as Response);
  }

  const mockValidationReport = {
    reportId: 'VAL-SPEC-LOGIN-001-1791637471880',
    specId: 'SPEC-LOGIN-001',
    timestamp: '2026-10-10T13:00:00.000Z',
    platform: 'web',
    overallStatus: 'PASSED',
    eligibleForPromotion: true,
    staticValidation: {
      passed: true,
      typeScriptCheck: { passed: true, errors: [] },
      lintCheck: { passed: true, errors: [], warnings: [] },
      selectorValidation: {
        passed: true,
        validCount: 5,
        warnings: [],
        locatorsFound: ["getByRole('button')", "getByPlaceholder('Username')"],
      },
      importValidation: { passed: true, errors: [], imports: ['@playwright/test'] },
    },
    dynamicValidation: {
      passed: true,
      executed: true,
      totalTests: 1,
      passedCount: 1,
      failedCount: 0,
      skippedCount: 0,
      durationMs: 450,
      mode: 'simulated',
      tests: [
        {
          testCaseId: 'TC-LOGIN-001',
          title: 'TC-LOGIN-001: Successful Admin Login',
          status: 'passed',
          durationMs: 450,
          consoleLogs: ['[test] [info] Navigated to login page', '[test] [info] Login successful'],
        },
      ],
      artifacts: { screenshots: [], traces: [], reports: ['test-results/results.json'] },
    },
    conformanceCheck: {
      passed: true,
      approvedTestCaseIds: ['TC-LOGIN-001'],
      executedTestCaseIds: ['TC-LOGIN-001'],
      covered: ['TC-LOGIN-001'],
      missing: [],
      unmapped: [],
      failedTests: [],
      details: ['TC-LOGIN-001 covered and passed'],
    },
    healingSummary: {
      attempted: false,
      totalAttempts: 0,
      maxAttempts: 3,
      successful: false,
      attempts: [],
    },
    metadata: {
      targetApp: 'OrangeHRM',
      environment: 'staging',
      executionMode: 'simulated',
    },
  };

  if (urlStr.includes('/validate') || urlStr.includes('/revalidate')) {
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true, data: mockValidationReport }),
    } as Response);
  }

  if (urlStr.includes('/validation-reports/latest')) {
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true, data: mockValidationReport }),
    } as Response);
  }

  if (urlStr.includes('/validation-reports') || urlStr.includes('/reports/execution-results')) {
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true, data: [mockValidationReport] }),
    } as Response);
  }

  if (urlStr.includes('/workspace/files')) {
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          success: true,
          data: {
            files: [
              'playwright.config.ts',
              'web/pages/LoginPage.ts',
              'web/tests/SPEC-LOGIN-001/TC-LOGIN-001.spec.ts',
            ],
            workspaceDir: 'D:/GenAI_Tools/workspace',
          },
        }),
    } as Response);
  }

  if (urlStr.includes('/workspace/file')) {
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          success: true,
          data: {
            path: 'web/tests/SPEC-LOGIN-001/TC-LOGIN-001.spec.ts',
            content: "// Test Case ID: TC-LOGIN-001\ntest('TC-LOGIN-001', async () => {});",
          },
        }),
    } as Response);
  }

  if (urlStr.includes('/generate-scripts')) {
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          success: true,
          data: {
            specId: 'SPEC-LOGIN-001',
            targetApp: 'OrangeHRM',
            platform: 'web',
            approvedTestCases: ['TC-LOGIN-001'],
            generatedFiles: [
              {
                path: 'web/tests/SPEC-LOGIN-001/TC-LOGIN-001.spec.ts',
                category: 'test',
                platform: 'web',
                size: 500,
              },
            ],
            workspaceDir: 'D:/GenAI_Tools/workspace',
            configFiles: ['playwright.config.ts'],
            timestamp: new Date().toISOString(),
          },
        }),
    } as Response);
  }

  if (urlStr.includes('/heal')) {
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          success: true,
          data: {
            specId: 'SPEC-LOGIN-001',
            healed: true,
            totalAttempts: 1,
            healingSummary: {
              attempted: true,
              totalAttempts: 1,
              maxAttempts: 3,
              successful: true,
              attempts: [],
            },
            latestReport: mockValidationReport,
          },
        }),
    } as Response);
  }

  if (urlStr.includes('/quality-gate')) {
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          success: true,
          data: {
            specId: 'SPEC-LOGIN-001',
            passed: true,
            status: 'PASSED',
            gates: [
              {
                gate: 'APPROVED_SPECIFICATION',
                passed: true,
                name: 'Approved Specification',
                description: 'Specification approved',
              },
              {
                gate: 'APPROVED_TEST_CASES',
                passed: true,
                name: 'Approved Test Cases',
                description: 'Test cases approved',
              },
              {
                gate: 'SCRIPTS_MAP_TO_APPROVED_TEST_CASES',
                passed: true,
                name: 'Scripts Map to Approved Test Cases',
                description: 'Mapped to approved test cases',
              },
              {
                gate: 'SCRIPTS_COMPILE_SUCCESSFULLY',
                passed: true,
                name: 'Scripts Compile Successfully',
                description: 'Clean compilation',
              },
              {
                gate: 'SCRIPTS_PASS_AUTOMATED_EXECUTION',
                passed: true,
                name: 'Scripts Pass Automated Execution',
                description: 'Passing execution',
              },
              {
                gate: 'EXECUTION_EVIDENCE_STORED',
                passed: true,
                name: 'Execution Evidence Stored',
                description: 'Reports stored',
              },
              {
                gate: 'NO_UNAPPROVED_FUNCTIONALITY_AUTOMATED',
                passed: true,
                name: 'No Unapproved Functionality Automated',
                description: 'No unmapped tests',
              },
              {
                gate: 'SPEC_UP_TO_DATE_NO_REVALIDATION_REQUIRED',
                passed: true,
                name: 'Spec Up To Date',
                description: 'Up to date',
              },
            ],
            revalidationRequired: false,
            promoted: false,
            evaluatedAt: new Date().toISOString(),
          },
        }),
    } as Response);
  }

  if (urlStr.includes('/promote')) {
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          success: true,
          data: {
            success: true,
            specId: 'SPEC-LOGIN-001',
            promotedAt: new Date().toISOString(),
            validationReportId: 'VAL-SPEC-LOGIN-001-1791637471880',
            promotedFiles: [
              {
                sourcePath: 'web/tests/SPEC-LOGIN-001/TC-LOGIN-001.spec.ts',
                targetPath: 'automation/web/tests/TC-LOGIN-001.spec.ts',
                category: 'test',
                platform: 'web',
                size: 500,
              },
            ],
          },
        }),
    } as Response);
  }

  if (urlStr.includes('/api/specs/SPEC-LOGIN-001')) {
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          success: true,
          data: {
            specId: 'SPEC-LOGIN-001',
            userStoryJson: {
              id: 'SPEC-LOGIN-001',
              title: 'Admin Authentication',
              story: 'As an Admin, I want to log in...',
              acceptanceCriteria: ['Valid credentials redirect to dashboard'],
              priority: 'high',
              platform: 'web',
              targetApp: 'OrangeHRM',
              createdAt: '2026-10-10T00:00:00.000Z',
              updatedAt: '2026-10-10T00:00:00.000Z',
            },
            specification: '# Specification\n\n## Business Objective\nVerify secure authentication',
            specificationJson: {
              specId: 'SPEC-LOGIN-001',
              title: 'Admin Authentication Specification',
              businessObjective: 'Verify secure authentication of admin users.',
              actors: ['Administrator'],
              preconditions: ['Browser open on login page'],
              mainFlow: [
                { step: 1, action: 'Enter credentials', expected: 'Form filled' },
                { step: 2, action: 'Submit', expected: 'Redirected to Dashboard' },
              ],
              alternateFlows: [],
              exceptionFlows: [
                { name: 'Invalid Credentials', condition: 'Wrong password', action: 'Show error' },
              ],
              dataRequirements: [{ field: 'username', type: 'string', rules: 'Required' }],
              acceptanceCriteria: ['Valid credentials redirect to dashboard'],
              nonFunctionalRequirements: ['Response time under 2s'],
              targetApp: 'OrangeHRM',
              environment: 'staging',
            },
            testCasesJson: [
              {
                id: 'TC-LOGIN-001',
                specId: 'SPEC-LOGIN-001',
                title: 'Successful Admin Login',
                preconditions: ['OrangeHRM login page accessible'],
                testSteps: [
                  {
                    stepNumber: 1,
                    action: 'Enter credentials',
                    expectedResult: 'Fields populated',
                  },
                  { stepNumber: 2, action: 'Click Login', expectedResult: 'Dashboard page loaded' },
                ],
                expectedResults: ['User authenticated', 'Dashboard visible'],
                priority: 'high',
                testType: 'functional',
                targetPlatform: 'web',
                automationSuitability: 'automatable',
              },
            ],
            approvalRecord: {
              specId: 'SPEC-LOGIN-001',
              status: 'Under Review',
              reviewer: 'System',
              comments: 'Intake completed',
              approvedTestCases: [],
              timestamp: '2026-10-10T00:00:00.000Z',
            },
            files: ['user-story.md', 'specification.md', 'test-cases.md', 'approval-record.json'],
          },
        }),
    } as Response);
  }

  if (urlStr.includes('/api/specs')) {
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          success: true,
          data: [
            {
              specId: 'SPEC-LOGIN-001',
              title: 'Admin Authentication',
              status: 'Under Review',
              hasUserStory: true,
              hasSpecification: true,
              hasTestCases: true,
              hasApprovalRecord: true,
              testCaseCount: 1,
              targetApp: 'OrangeHRM',
              platform: 'web',
              priority: 'high',
              promoted: false,
              updatedAt: '2026-10-10T00:00:00.000Z',
            },
          ],
        }),
    } as Response);
  }

  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ success: true, data: [] }),
  } as Response);
});
