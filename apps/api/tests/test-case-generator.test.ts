import {
  TestCaseSchema,
  type Specification,
  type TestCase,
  type UserStoryRecord,
} from '@qaa/shared';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { BaseLLMProvider } from '../src/providers/base-provider.js';
import { ProviderRegistry } from '../src/providers/registry.js';
import { formatTestCasesMarkdown } from '../src/services/markdown-formatters.js';
import { TestCaseGenerator } from '../src/services/test-case-generator.js';

describe('TestCaseGenerator (§3.3)', () => {
  const sampleSpec: Specification = {
    specId: 'SPEC-LOGIN-001',
    title: 'User Login',
    businessObjective: 'Authenticate HR users into OrangeHRM',
    actors: ['HR user'],
    preconditions: ['Browser open on OrangeHRM login page'],
    mainFlow: [
      { step: 1, action: 'Navigate to login', expected: 'Login page displayed' },
      { step: 2, action: 'Enter credentials', expected: 'Inputs filled' },
      { step: 3, action: 'Click login button', expected: 'Dashboard displayed' },
    ],
    alternateFlows: [
      {
        name: 'Remember me',
        steps: ['Check remember me', 'Click login button'],
      },
    ],
    exceptionFlows: [
      {
        name: 'Invalid credentials',
        condition: 'User enters bad password',
        action: 'Display "Invalid credentials" error banner',
      },
    ],
    dataRequirements: [
      { field: 'username', type: 'string', rules: 'required, non-empty' },
      { field: 'password', type: 'string', rules: 'required, masked' },
    ],
    acceptanceCriteria: [
      'Valid username and password should navigate to the dashboard.',
      'Invalid credentials should display an error message.',
      'Empty fields should prevent login.',
    ],
    nonFunctionalRequirements: ['Response under 3s'],
    targetApp: 'OrangeHRM',
    environment: 'default',
  };

  const sampleStory: UserStoryRecord = {
    id: 'SPEC-LOGIN-001',
    title: 'User Login',
    story: 'As an HR user, I want to log in to OrangeHRM',
    acceptanceCriteria: sampleSpec.acceptanceCriteria,
    priority: 'high',
    platform: 'web',
    targetApp: 'OrangeHRM',
    createdAt: '2026-10-10T12:00:00Z',
    updatedAt: '2026-10-10T12:00:00Z',
  };

  it('generates test cases strictly derived from specification (§3.3)', async () => {
    const generator = new TestCaseGenerator();
    const testCases = await generator.generate(sampleSpec, sampleStory);

    const parsed = z.array(TestCaseSchema).safeParse(testCases);
    expect(parsed.success).toBe(true);

    expect(testCases.length).toBeGreaterThanOrEqual(4);

    // All test cases must reference the spec ID
    testCases.forEach((tc) => {
      expect(tc.specId).toBe('SPEC-LOGIN-001');
      expect(tc.id).toMatch(/^TC-LOGIN-\d{3}$/);
      expect(tc.testSteps.length).toBeGreaterThan(0);
      expect(tc.expectedResults.length).toBeGreaterThan(0);
    });

    // Main flow functional test
    const functionalTc = testCases.find((tc) => tc.testType === 'functional');
    expect(functionalTc).toBeDefined();
    expect(functionalTc?.title).toContain('main flow');

    // Exception flow negative test
    const negativeTc = testCases.find((tc) => tc.testType === 'negative');
    expect(negativeTc).toBeDefined();
    expect(negativeTc?.title).toContain('Invalid credentials');
    expect(negativeTc?.expectedResults[0]).toContain('Invalid credentials');

    // Alternate flow test
    const altTc = testCases.find((tc) => tc.title.includes('Remember me'));
    expect(altTc).toBeDefined();

    // Boundary / data requirement test
    const boundaryTc = testCases.find((tc) => tc.testType === 'boundary');
    expect(boundaryTc).toBeDefined();
    expect(boundaryTc?.title).toContain('data validation rules');
  });

  it('formats test cases into clean Markdown document (§3.3)', async () => {
    const generator = new TestCaseGenerator();
    const testCases = await generator.generate(sampleSpec, sampleStory);
    const md = formatTestCasesMarkdown(sampleSpec.specId, testCases, sampleSpec.title);

    expect(md).toContain('# Test Cases: User Login (SPEC-LOGIN-001)');
    expect(md).toContain('## Summary');
    expect(md).toContain('- **Specification ID:** SPEC-LOGIN-001');
    expect(md).toContain(`- **Total Test Cases:** ${testCases.length}`);
    expect(md).toContain('### TC-LOGIN-001:');
    expect(md).toContain('#### Preconditions');
    expect(md).toContain('#### Test Steps');
    expect(md).toContain('| Step | Action | Expected Result |');
    expect(md).toContain('#### Expected Results');
  });

  it('normalizes test case IDs and enforces specId from LLM response', async () => {
    class MockProvider extends BaseLLMProvider {
      readonly name = 'groq' as const;
      readonly displayName = 'Mock Groq';
      readonly defaultModel = 'mock-model';
      readonly models = ['mock-model'];

      async generate() {
        const mockTcs: TestCase[] = [
          {
            id: 'WRONG-ID-999',
            specId: 'DIFFERENT-SPEC',
            title: 'Mock Test Case 1',
            preconditions: ['Ready'],
            testSteps: [{ stepNumber: 1, action: 'Click', expectedResult: 'Done' }],
            expectedResults: ['Success'],
            priority: 'high',
            testType: 'functional',
            targetPlatform: 'web',
            automationSuitability: 'automatable',
          },
        ];
        return {
          text: JSON.stringify(mockTcs),
          provider: 'groq' as const,
          model: 'mock-model',
        };
      }
    }

    const mockRegistry = {
      resolveProvider: () => ({
        provider: new MockProvider('mock-key', 'https://mock.groq.com'),
        model: 'mock-model',
      }),
    } as unknown as ProviderRegistry;

    const generator = new TestCaseGenerator(mockRegistry);
    const testCases = await generator.generate(sampleSpec, sampleStory, { provider: 'groq' });

    expect(testCases.length).toBe(1);
    expect(testCases[0]?.id).toBe('TC-LOGIN-001');
    expect(testCases[0]?.specId).toBe('SPEC-LOGIN-001');
  });
});
