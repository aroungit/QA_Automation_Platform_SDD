import { SpecificationSchema, type Specification, type UserStoryRecord } from '@qaa/shared';
import type { ProviderRegistry } from '../providers/registry.js';
import { getProviderRegistry } from '../providers/registry.js';

export interface GenerateSpecOptions {
  provider?: string;
  model?: string;
  temperature?: number;
}

export class SpecificationGenerator {
  constructor(private readonly registry?: ProviderRegistry) {}

  private getRegistry(): ProviderRegistry {
    return this.registry ?? getProviderRegistry();
  }

  /**
   * Generates a structured Specification from a UserStoryRecord (§3.2)
   */
  async generate(story: UserStoryRecord, options?: GenerateSpecOptions): Promise<Specification> {
    const registry = this.getRegistry();

    // Check if an LLM provider can be used
    let resolvedProvider;
    let resolvedModel: string;
    try {
      const resolved = registry.resolveProvider(options?.provider, options?.model);
      resolvedProvider = resolved.provider;
      resolvedModel = resolved.model;
    } catch {
      // Fallback if provider cannot be resolved
      resolvedProvider = null;
      resolvedModel = '';
    }

    if (resolvedProvider && resolvedProvider.isConfigured()) {
      try {
        const prompt = this.buildPrompt(story);
        const generated = await resolvedProvider.generateJSON<Specification>(
          prompt,
          SpecificationSchema,
          {
            model: resolvedModel,
            temperature: options?.temperature ?? 0.2,
            systemPrompt:
              'You are a Senior QA Software Architect following Spec-Driven Development (SDD). ' +
              'Given a user story, acceptance criteria, priority, target application, and platform, ' +
              'convert it into a rigorous, complete Functional Specification matching the requested JSON schema. ' +
              'Every acceptance criterion must be addressed in the flows.',
          },
        );

        // Ensure specId and targetApp match source of truth
        return SpecificationSchema.parse({
          ...generated,
          specId: story.id,
          targetApp: story.targetApp,
        });
      } catch (err) {
        // If LLM call fails, we can throw or fall back depending on context
        // In SDD architecture, if provider fails, fallback ensures determinism
        console.warn(
          `[SpecificationGenerator] LLM generation failed (${(err as Error).message}). Generating deterministic fallback spec.`,
        );
      }
    }

    // Deterministic fallback specification generator
    return this.generateDeterministic(story);
  }

  /**
   * Deterministic template generator for offline or test environments
   */
  generateDeterministic(story: UserStoryRecord): Specification {
    // Extract actor from story if "As a/an <actor>"
    let actor = 'Standard User';
    const actorMatch = story.story.match(/As an?\s+([^,\n]+)/i);
    if (actorMatch && actorMatch[1]) {
      actor = actorMatch[1].trim();
    }

    // Extract objective from story if "I want/need to <objective>"
    let objective = story.story.trim();
    const wantMatch = story.story.match(/I (?:want|need) to\s+([^,\n]+)/i);
    const soThatMatch = story.story.match(/So that\s+([^,\n.]+)/i);
    if (wantMatch && wantMatch[1]) {
      const wantText = wantMatch[1].trim();
      const soThatText =
        soThatMatch && soThatMatch[1] ? ` in order to ${soThatMatch[1].trim()}` : '';
      objective = `Enable ${actor} to ${wantText}${soThatText}.`;
    }

    // Partition criteria into main flow, alternate, exception
    const exceptionCriteria: string[] = [];
    const normalCriteria: string[] = [];

    for (const ac of story.acceptanceCriteria) {
      if (/invalid|error|prevent|empty|incorrect|fail|reject|unauthorized|blocked/i.test(ac)) {
        exceptionCriteria.push(ac);
      } else {
        normalCriteria.push(ac);
      }
    }

    const mainFlowSteps = [
      {
        step: 1,
        action: `Navigate to ${story.targetApp} ${story.title} interface on ${story.platform}`,
        expected: `${story.title} view is loaded and ready for interaction`,
      },
      {
        step: 2,
        action: 'Enter required input data according to standard positive criteria',
        expected: 'Inputs are populated and validated without errors',
      },
      {
        step: 3,
        action: 'Submit or confirm the primary action',
        expected:
          normalCriteria.length > 0 && normalCriteria[0]
            ? normalCriteria[0]
            : 'Primary action completes successfully',
      },
    ];

    if (normalCriteria.length > 1) {
      for (let i = 1; i < normalCriteria.length; i++) {
        const criterion = normalCriteria[i] ?? `Acceptance criterion ${i + 1}`;
        mainFlowSteps.push({
          step: i + 3,
          action: `Verify acceptance condition: ${criterion}`,
          expected: criterion,
        });
      }
    }

    const exceptionFlows = exceptionCriteria.map((ac, idx) => ({
      name: `Exception ${idx + 1}: ${ac.slice(0, 40)}`,
      condition: `Trigger condition related to: ${ac}`,
      action: `Display appropriate validation error or prevention mechanism (${ac})`,
    }));

    const alternateFlows =
      story.acceptanceCriteria.length > 3
        ? [
            {
              name: `Alternate Flow: Secondary action pathway`,
              steps: [
                `Navigate to ${story.targetApp} secondary options`,
                'Perform alternate action sequence',
                'Verify alternative state matches expected behavior',
              ],
            },
          ]
        : [];

    // Extract data requirements from title or story
    const dataRequirements = [
      {
        field: 'primaryIdentifier',
        type: 'string',
        rules: 'required, non-empty',
      },
    ];

    if (/login|auth|credential/i.test(story.title + ' ' + story.story)) {
      dataRequirements.length = 0;
      dataRequirements.push(
        { field: 'username', type: 'string', rules: 'required, valid format' },
        { field: 'password', type: 'string', rules: 'required, masked' },
      );
    }

    const rawSpec: Specification = {
      specId: story.id,
      title: story.title,
      businessObjective: objective,
      actors: [actor],
      preconditions: [
        `Target application ${story.targetApp} is reachable in the test environment`,
        `User is in an authorized initial state on ${story.platform}`,
      ],
      mainFlow: mainFlowSteps,
      alternateFlows,
      exceptionFlows,
      dataRequirements,
      acceptanceCriteria: [...story.acceptanceCriteria],
      nonFunctionalRequirements: [
        'Operations should respond within 3000ms',
        'UI elements must have accessible and stable test selectors',
      ],
      targetApp: story.targetApp,
      environment: 'default',
    };

    return SpecificationSchema.parse(rawSpec);
  }

  private buildPrompt(story: UserStoryRecord): string {
    return `
Convert the following User Story and Acceptance Criteria into a formal Functional Specification conforming to Spec-Driven Development:

SPEC ID: ${story.id}
FEATURE TITLE: ${story.title}
TARGET APPLICATION: ${story.targetApp}
PLATFORM: ${story.platform}
PRIORITY: ${story.priority}

USER STORY:
${story.story}

ACCEPTANCE CRITERIA:
${story.acceptanceCriteria.map((c, i) => `${i + 1}. ${c}`).join('\n')}

Generate a JSON object matching this schema:
{
  "specId": "${story.id}",
  "title": "${story.title}",
  "businessObjective": "string",
  "actors": ["string"],
  "preconditions": ["string"],
  "mainFlow": [
    { "step": 1, "action": "string", "expected": "string" }
  ],
  "alternateFlows": [
    { "name": "string", "steps": ["string"] }
  ],
  "exceptionFlows": [
    { "name": "string", "condition": "string", "action": "string" }
  ],
  "dataRequirements": [
    { "field": "string", "type": "string", "rules": "string" }
  ],
  "acceptanceCriteria": ${JSON.stringify(story.acceptanceCriteria)},
  "nonFunctionalRequirements": ["string"],
  "targetApp": "${story.targetApp}",
  "environment": "default"
}
`.trim();
  }
}
