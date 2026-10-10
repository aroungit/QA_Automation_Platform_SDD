import {
  TestCaseSchema,
  type Platform,
  type Priority,
  type Specification,
  type TestCase,
  type UserStoryRecord,
} from '@qaa/shared';
import { z } from 'zod';
import type { ProviderRegistry } from '../providers/registry.js';
import { getProviderRegistry } from '../providers/registry.js';
import { generateTestCaseId } from '../storage/id-generator.js';

export interface GenerateTestCasesOptions {
  provider?: string;
  model?: string;
  temperature?: number;
}

export class TestCaseGenerator {
  constructor(private readonly registry?: ProviderRegistry) {}

  private getRegistry(): ProviderRegistry {
    return this.registry ?? getProviderRegistry();
  }

  /**
   * Generates test cases strictly from a Specification (§3.3)
   * Rule: Test cases must not introduce behavior that is absent from the specification.
   */
  async generate(
    spec: Specification,
    userStory?: UserStoryRecord,
    options?: GenerateTestCasesOptions,
  ): Promise<TestCase[]> {
    const registry = this.getRegistry();

    let resolvedProvider;
    let resolvedModel: string;
    try {
      const resolved = registry.resolveProvider(options?.provider, options?.model);
      resolvedProvider = resolved.provider;
      resolvedModel = resolved.model;
    } catch {
      resolvedProvider = null;
      resolvedModel = '';
    }

    if (resolvedProvider && resolvedProvider.isConfigured()) {
      try {
        const prompt = this.buildPrompt(spec, userStory);
        const testCasesArraySchema = z.array(TestCaseSchema);

        const generated = await resolvedProvider.generateJSON<TestCase[]>(
          prompt,
          testCasesArraySchema,
          {
            model: resolvedModel,
            temperature: options?.temperature ?? 0.2,
            systemPrompt:
              'You are an expert QA Automation Engineer following Spec-Driven Development (SDD). ' +
              'CRITICAL RULE: Test cases must NOT introduce behavior that is absent from the specification. ' +
              'Every step and assertion must be strictly derived from the provided specification flows, ' +
              'acceptance criteria, and data requirements. ' +
              'Return ONLY a valid JSON array of TestCase objects matching the schema.',
          },
        );

        // Normalize IDs and enforce specId traceability (§3.3, §3.5)
        const normalized = generated.map((tc, index) => {
          return {
            ...tc,
            id: generateTestCaseId(spec.specId, index + 1),
            specId: spec.specId,
          };
        });

        return testCasesArraySchema.parse(normalized);
      } catch (err) {
        console.warn(
          `[TestCaseGenerator] LLM generation failed (${(err as Error).message}). Generating deterministic fallback test cases.`,
        );
      }
    }

    // Deterministic fallback generator
    return this.generateDeterministic(spec, userStory);
  }

  /**
   * Deterministic test case generation strictly derived from the specification
   */
  generateDeterministic(spec: Specification, userStory?: UserStoryRecord): TestCase[] {
    const testCases: TestCase[] = [];
    const platform: Platform = userStory?.platform ?? 'web';
    const basePriority: Priority = userStory?.priority ?? 'medium';
    let counter = 1;

    // 1. Positive Functional Test Case from Main Flow (§3.2, §3.3)
    const mainSteps =
      spec.mainFlow.length > 0
        ? spec.mainFlow.map((f) => ({
            stepNumber: f.step,
            action: f.action,
            expectedResult: f.expected,
          }))
        : [
            {
              stepNumber: 1,
              action: `Navigate to ${spec.targetApp} interface`,
              expectedResult: 'Interface is displayed',
            },
            {
              stepNumber: 2,
              action: 'Execute primary operation',
              expectedResult: spec.acceptanceCriteria[0] ?? 'Operation succeeds',
            },
          ];

    testCases.push({
      id: generateTestCaseId(spec.specId, counter++),
      specId: spec.specId,
      title: `Verify positive main flow for ${spec.title}`,
      preconditions: [...spec.preconditions],
      testSteps: mainSteps,
      expectedResults: [
        spec.mainFlow[spec.mainFlow.length - 1]?.expected ??
          spec.acceptanceCriteria[0] ??
          'Successful execution of main flow',
      ],
      priority: basePriority === 'low' ? 'medium' : 'high',
      testType: 'functional',
      targetPlatform: platform,
      automationSuitability: 'automatable',
    });

    // 2. Negative Test Cases from Exception Flows (§3.2, §3.3)
    if (spec.exceptionFlows && spec.exceptionFlows.length > 0) {
      spec.exceptionFlows.forEach((exc) => {
        testCases.push({
          id: generateTestCaseId(spec.specId, counter++),
          specId: spec.specId,
          title: `Verify exception handling: ${exc.name}`,
          preconditions: [...spec.preconditions],
          testSteps: [
            {
              stepNumber: 1,
              action: `Set up scenario where ${exc.condition}`,
              expectedResult: 'Condition is established',
            },
            {
              stepNumber: 2,
              action: `Trigger action under exception condition`,
              expectedResult: exc.action,
            },
          ],
          expectedResults: [exc.action],
          priority: 'medium',
          testType: 'negative',
          targetPlatform: platform,
          automationSuitability: 'automatable',
        });
      });
    }

    // 3. Test Cases for Alternate Flows (§3.2, §3.3)
    if (spec.alternateFlows && spec.alternateFlows.length > 0) {
      spec.alternateFlows.forEach((alt) => {
        const altSteps = alt.steps.map((s, idx) => ({
          stepNumber: idx + 1,
          action: s,
          expectedResult: `Step ${idx + 1} completes as expected`,
        }));

        testCases.push({
          id: generateTestCaseId(spec.specId, counter++),
          specId: spec.specId,
          title: `Verify alternate flow: ${alt.name}`,
          preconditions: [...spec.preconditions],
          testSteps:
            altSteps.length > 0
              ? altSteps
              : [
                  {
                    stepNumber: 1,
                    action: `Execute alternate flow ${alt.name}`,
                    expectedResult: 'Flow executes successfully',
                  },
                ],
          expectedResults: [`Alternate pathway ${alt.name} completes successfully`],
          priority: 'medium',
          testType: 'functional',
          targetPlatform: platform,
          automationSuitability: 'automatable',
        });
      });
    }

    // 4. Boundary / Field Validation Test Case from Data Requirements
    if (spec.dataRequirements && spec.dataRequirements.length > 0) {
      const fieldRules = spec.dataRequirements.map((d) => `${d.field} (${d.rules})`).join(', ');
      testCases.push({
        id: generateTestCaseId(spec.specId, counter++),
        specId: spec.specId,
        title: `Verify data validation rules for ${spec.title}`,
        preconditions: [...spec.preconditions],
        testSteps: [
          {
            stepNumber: 1,
            action: `Attempt input violating rules for: ${fieldRules}`,
            expectedResult: 'Validation error displayed, submission blocked',
          },
          {
            stepNumber: 2,
            action: `Provide compliant inputs for: ${fieldRules}`,
            expectedResult: 'Inputs accepted without errors',
          },
        ],
        expectedResults: ['System enforces input data requirements correctly'],
        priority: 'medium',
        testType: 'boundary',
        targetPlatform: platform,
        automationSuitability: 'automatable',
      });
    }

    // Ensure all test cases match schema
    return z.array(TestCaseSchema).parse(testCases);
  }

  private buildPrompt(spec: Specification, userStory?: UserStoryRecord): string {
    return `
You are an expert QA Automation Engineer following Spec-Driven Development (SDD).

CRITICAL RULE:
Test cases must NOT introduce behavior that is absent from the specification.
Every test step, precondition, and expected result must be strictly derived from the specification.

SPECIFICATION:
${JSON.stringify(spec, null, 2)}

${userStory ? `ORIGINAL USER STORY:\n${userStory.story}\n` : ''}

Generate an array of test cases strictly covering:
1. Positive functional test cases from the main flow.
2. Negative / exception test cases from the exception flows.
3. Functional test cases from alternate flows.
4. Boundary / validation test cases from data requirements.

Return a JSON array of TestCase objects adhering to this schema:
[
  {
    "id": "TC-<SLUG>-001",
    "specId": "${spec.specId}",
    "title": "string",
    "preconditions": ["string"],
    "testSteps": [
      {
        "stepNumber": 1,
        "action": "string",
        "expectedResult": "string"
      }
    ],
    "expectedResults": ["string"],
    "priority": "critical" | "high" | "medium" | "low",
    "testType": "functional" | "negative" | "boundary" | "regression" | "accessibility" | "smoke",
    "targetPlatform": "web" | "mobile" | "both",
    "automationSuitability": "automatable" | "manual-only" | "needs-clarification"
  }
]
`.trim();
  }
}
