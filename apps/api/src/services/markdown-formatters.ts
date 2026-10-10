import type { Specification, TestCase, UserStoryRecord } from '@qaa/shared';

/**
 * Formats a UserStoryRecord into standard user-story.md representation (§3.1)
 */
export function formatUserStoryMarkdown(story: UserStoryRecord): string {
  const lines: string[] = [
    `# User Story: ${story.title}`,
    '',
    `**Spec ID:** ${story.id}  `,
    `**Target Application:** ${story.targetApp}  `,
    `**Platform:** ${story.platform}  `,
    `**Priority:** ${story.priority}  `,
    `**Created:** ${story.createdAt}  `,
    `**Updated:** ${story.updatedAt}  `,
    '',
    '## Story Description',
    '',
    story.story.trim(),
    '',
    '## Acceptance Criteria',
    '',
  ];

  story.acceptanceCriteria.forEach((criterion, idx) => {
    lines.push(`${idx + 1}. ${criterion.trim()}`);
  });

  lines.push('');
  return lines.join('\n');
}

/**
 * Formats a Specification into structured specification.md representation (§3.2)
 */
export function formatSpecificationMarkdown(spec: Specification): string {
  const lines: string[] = [
    `# Specification: ${spec.title}`,
    '',
    `**Spec ID:** ${spec.specId}  `,
    `**Target Application:** ${spec.targetApp}  `,
    `**Environment:** ${spec.environment || 'default'}  `,
    '',
    '## Business Objective',
    '',
    spec.businessObjective.trim(),
    '',
    '## Actors',
    '',
  ];

  if (spec.actors && spec.actors.length > 0) {
    spec.actors.forEach((actor) => lines.push(`- ${actor.trim()}`));
  } else {
    lines.push('- Standard User');
  }

  lines.push('', '## Preconditions', '');
  if (spec.preconditions && spec.preconditions.length > 0) {
    spec.preconditions.forEach((pre) => lines.push(`- ${pre.trim()}`));
  } else {
    lines.push('- None');
  }

  lines.push('', '## Main Flow', '');
  if (spec.mainFlow && spec.mainFlow.length > 0) {
    lines.push('| Step | Action | Expected Result |');
    lines.push('| --- | --- | --- |');
    spec.mainFlow.forEach((f) => {
      lines.push(
        `| ${f.step} | ${f.action.replace(/\|/g, '\\|')} | ${f.expected.replace(/\|/g, '\\|')} |`,
      );
    });
  } else {
    lines.push('No main flow defined.');
  }

  lines.push('', '## Alternate Flows', '');
  if (spec.alternateFlows && spec.alternateFlows.length > 0) {
    spec.alternateFlows.forEach((alt) => {
      lines.push(`### Flow: ${alt.name}`, '');
      alt.steps.forEach((s, idx) => lines.push(`${idx + 1}. ${s.trim()}`));
      lines.push('');
    });
  } else {
    lines.push('None.');
  }

  lines.push('', '## Exception Flows', '');
  if (spec.exceptionFlows && spec.exceptionFlows.length > 0) {
    spec.exceptionFlows.forEach((exc) => {
      lines.push(`### Flow: ${exc.name}`, '');
      lines.push(`- **Condition:** ${exc.condition.trim()}`);
      lines.push(`- **Action:** ${exc.action.trim()}`);
      lines.push('');
    });
  } else {
    lines.push('None.');
  }

  lines.push('', '## Data Requirements', '');
  if (spec.dataRequirements && spec.dataRequirements.length > 0) {
    lines.push('| Field | Type | Rules |');
    lines.push('| --- | --- | --- |');
    spec.dataRequirements.forEach((d) => {
      lines.push(`| ${d.field} | ${d.type} | ${d.rules.replace(/\|/g, '\\|')} |`);
    });
  } else {
    lines.push('None specified.');
  }

  lines.push('', '## Acceptance Criteria', '');
  spec.acceptanceCriteria.forEach((ac, idx) => {
    lines.push(`${idx + 1}. ${ac.trim()}`);
  });

  if (spec.nonFunctionalRequirements && spec.nonFunctionalRequirements.length > 0) {
    lines.push('', '## Non-Functional Requirements', '');
    spec.nonFunctionalRequirements.forEach((nfr) => lines.push(`- ${nfr.trim()}`));
  }

  lines.push('');
  return lines.join('\n');
}

/**
 * Formats an array of TestCases into test-cases.md representation (§3.3)
 */
export function formatTestCasesMarkdown(
  specId: string,
  testCases: TestCase[],
  specTitle?: string,
): string {
  const lines: string[] = [
    `# Test Cases: ${specTitle ? `${specTitle} ` : ''}(${specId})`,
    '',
    '## Summary',
    `- **Specification ID:** ${specId}`,
    `- **Total Test Cases:** ${testCases.length}`,
    `- **Automatable:** ${testCases.filter((t) => t.automationSuitability === 'automatable').length}`,
    `- **Manual Only:** ${testCases.filter((t) => t.automationSuitability === 'manual-only').length}`,
    `- **Needs Clarification:** ${testCases.filter((t) => t.automationSuitability === 'needs-clarification').length}`,
    '',
    '---',
    '',
  ];

  testCases.forEach((tc, idx) => {
    lines.push(`### ${tc.id}: ${tc.title}`);
    lines.push('');
    lines.push(`- **Specification ID:** ${tc.specId}`);
    lines.push(`- **Priority:** ${tc.priority}`);
    lines.push(`- **Type:** ${tc.testType}`);
    lines.push(`- **Target Platform:** ${tc.targetPlatform}`);
    lines.push(`- **Automation Suitability:** ${tc.automationSuitability}`);
    lines.push('');

    lines.push('#### Preconditions');
    if (tc.preconditions && tc.preconditions.length > 0) {
      tc.preconditions.forEach((p) => lines.push(`- ${p.trim()}`));
    } else {
      lines.push('- None');
    }
    lines.push('');

    lines.push('#### Test Steps');
    if (tc.testSteps && tc.testSteps.length > 0) {
      lines.push('| Step | Action | Expected Result |');
      lines.push('| --- | --- | --- |');
      tc.testSteps.forEach((s) => {
        lines.push(
          `| ${s.stepNumber} | ${s.action.replace(/\|/g, '\\|')} | ${s.expectedResult.replace(/\|/g, '\\|')} |`,
        );
      });
    } else {
      lines.push('No steps provided.');
    }
    lines.push('');

    lines.push('#### Expected Results');
    if (tc.expectedResults && tc.expectedResults.length > 0) {
      tc.expectedResults.forEach((r) => lines.push(`- ${r.trim()}`));
    } else {
      lines.push('- As defined in test steps');
    }

    if (idx < testCases.length - 1) {
      lines.push('', '---', '');
    } else {
      lines.push('');
    }
  });

  return lines.join('\n');
}
