import { SpecificationSchema, type Specification, type UserStoryRecord } from '@qaa/shared';
import { describe, expect, it } from 'vitest';
import { BaseLLMProvider } from '../src/providers/base-provider.js';
import { ProviderRegistry } from '../src/providers/registry.js';
import { formatSpecificationMarkdown } from '../src/services/markdown-formatters.js';
import { SpecificationGenerator } from '../src/services/specification-generator.js';

describe('SpecificationGenerator (§3.2)', () => {
  const sampleStory: UserStoryRecord = {
    id: 'SPEC-LOGIN-001',
    title: 'User Login',
    story: 'As an HR user,\nI want to log in to OrangeHRM,\nSo that I can access the dashboard.',
    acceptanceCriteria: [
      'Valid username and password should navigate to the dashboard.',
      'Invalid credentials should display an error message.',
      'Empty fields should prevent login.',
    ],
    priority: 'high',
    platform: 'web',
    targetApp: 'OrangeHRM',
    createdAt: '2026-10-10T12:00:00Z',
    updatedAt: '2026-10-10T12:00:00Z',
  };

  it('generates a valid specification conforming to SpecificationSchema', async () => {
    const generator = new SpecificationGenerator();
    const spec = await generator.generate(sampleStory);

    // Schema validation
    const parsed = SpecificationSchema.safeParse(spec);
    expect(parsed.success).toBe(true);

    expect(spec.specId).toBe('SPEC-LOGIN-001');
    expect(spec.title).toBe('User Login');
    expect(spec.targetApp).toBe('OrangeHRM');
    expect(spec.actors).toContain('HR user');
    expect(spec.mainFlow.length).toBeGreaterThanOrEqual(3);
    expect(spec.acceptanceCriteria).toEqual(sampleStory.acceptanceCriteria);

    // Exception flows derived from error/invalid criteria
    expect(spec.exceptionFlows.length).toBe(2);
    expect(spec.exceptionFlows.some((e) => e.name.includes('Invalid credentials'))).toBe(true);
    expect(spec.exceptionFlows.some((e) => e.name.includes('Empty fields'))).toBe(true);

    // Data requirements
    expect(spec.dataRequirements.some((d) => d.field === 'username')).toBe(true);
    expect(spec.dataRequirements.some((d) => d.field === 'password')).toBe(true);
  });

  it('formats specification into clean Markdown document (§3.2)', async () => {
    const generator = new SpecificationGenerator();
    const spec = await generator.generate(sampleStory);
    const md = formatSpecificationMarkdown(spec);

    expect(md).toContain('# Specification: User Login');
    expect(md).toContain('**Spec ID:** SPEC-LOGIN-001');
    expect(md).toContain('**Target Application:** OrangeHRM');
    expect(md).toContain('## Business Objective');
    expect(md).toContain('## Actors');
    expect(md).toContain('- HR user');
    expect(md).toContain('## Preconditions');
    expect(md).toContain('## Main Flow');
    expect(md).toContain('| Step | Action | Expected Result |');
    expect(md).toContain('## Exception Flows');
    expect(md).toContain('## Data Requirements');
    expect(md).toContain('## Acceptance Criteria');
  });

  it('uses configured LLM provider when available', async () => {
    class MockProvider extends BaseLLMProvider {
      readonly name = 'groq' as const;
      readonly displayName = 'Mock Groq';
      readonly defaultModel = 'mock-model';
      readonly models = ['mock-model'];

      async generate() {
        const mockSpec: Specification = {
          specId: 'SPEC-LOGIN-001',
          title: 'User Login from Mock LLM',
          businessObjective: 'Authenticate user',
          actors: ['HR Manager'],
          preconditions: ['OrangeHRM running'],
          mainFlow: [{ step: 1, action: 'Open page', expected: 'Form visible' }],
          alternateFlows: [],
          exceptionFlows: [{ name: 'Invalid Auth', condition: 'Bad pass', action: 'Show error' }],
          dataRequirements: [{ field: 'user', type: 'string', rules: 'required' }],
          acceptanceCriteria: ['Valid login works'],
          nonFunctionalRequirements: ['Fast load'],
          targetApp: 'OrangeHRM',
          environment: 'test',
        };
        return {
          text: JSON.stringify(mockSpec),
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

    const generator = new SpecificationGenerator(mockRegistry);
    const spec = await generator.generate(sampleStory, { provider: 'groq' });

    expect(spec.title).toBe('User Login from Mock LLM');
    expect(spec.actors).toContain('HR Manager');
    expect(spec.specId).toBe('SPEC-LOGIN-001');
  });
});
