import { describe, expect, it } from 'vitest';
import { ConformanceChecker } from '../src/services/conformance-checker.js';

describe('ConformanceChecker (§3.6)', () => {
  const checker = new ConformanceChecker();

  it('passes when all approved test cases are covered, pass, and match spec ID', () => {
    const result = checker.check({
      specId: 'SPEC-LOGIN-001',
      approvedTestCaseIds: ['TC-LOGIN-001', 'TC-LOGIN-002'],
      executedTests: [
        {
          testCaseId: 'TC-LOGIN-001',
          title: 'TC-LOGIN-001: Valid login',
          status: 'passed',
          durationMs: 350,
        },
        {
          testCaseId: 'TC-LOGIN-002',
          title: 'TC-LOGIN-002: Invalid login',
          status: 'passed',
          durationMs: 400,
        },
      ],
      testFileContents: [
        {
          path: 'web/tests/SPEC-LOGIN-001/tc1.spec.ts',
          content: `// Spec ID: SPEC-LOGIN-001\n// Test Case ID: TC-LOGIN-001\ntest('...', () => {});`,
        },
        {
          path: 'web/tests/SPEC-LOGIN-001/tc2.spec.ts',
          content: `// Spec ID: SPEC-LOGIN-001\n// Test Case ID: TC-LOGIN-002\ntest('...', () => {});`,
        },
      ],
    });

    expect(result.passed).toBe(true);
    expect(result.covered).toEqual(['TC-LOGIN-001', 'TC-LOGIN-002']);
    expect(result.missing).toEqual([]);
    expect(result.unmapped).toEqual([]);
    expect(result.failedTests).toEqual([]);
  });

  it('fails if an approved test case is missing from executed tests (§3.6)', () => {
    const result = checker.check({
      specId: 'SPEC-LOGIN-001',
      approvedTestCaseIds: ['TC-LOGIN-001', 'TC-LOGIN-002', 'TC-LOGIN-003'],
      executedTests: [
        {
          testCaseId: 'TC-LOGIN-001',
          title: 'TC-LOGIN-001: Valid login',
          status: 'passed',
          durationMs: 300,
        },
      ],
    });

    expect(result.passed).toBe(false);
    expect(result.covered).toEqual(['TC-LOGIN-001']);
    expect(result.missing).toEqual(['TC-LOGIN-002', 'TC-LOGIN-003']);
  });

  it('fails and flags tests that pass but do not map to an approved specification (§3.6)', () => {
    const result = checker.check({
      specId: 'SPEC-LOGIN-001',
      approvedTestCaseIds: ['TC-LOGIN-001'],
      executedTests: [
        {
          testCaseId: 'TC-LOGIN-001',
          title: 'TC-LOGIN-001: Valid login',
          status: 'passed',
          durationMs: 300,
        },
        {
          testCaseId: 'TC-UNAPPROVED-999',
          title: 'TC-UNAPPROVED-999: Sneaky test',
          status: 'passed',
          durationMs: 200,
        },
      ],
    });

    expect(result.passed).toBe(false);
    expect(result.unmapped).toContain('TC-UNAPPROVED-999');
    expect(result.details.some((d) => d.includes('does not map'))).toBe(true);
  });

  it('fails when an executed test has failed (§3.6 - confirm failed tests are not committed)', () => {
    const result = checker.check({
      specId: 'SPEC-LOGIN-001',
      approvedTestCaseIds: ['TC-LOGIN-001'],
      executedTests: [
        {
          testCaseId: 'TC-LOGIN-001',
          title: 'TC-LOGIN-001: Valid login',
          status: 'failed',
          durationMs: 500,
          error: 'Element not found',
        },
      ],
    });

    expect(result.passed).toBe(false);
    expect(result.failedTests).toContain('TC-LOGIN-001');
    expect(result.details.some((d) => d.includes('Failed tests cannot be committed'))).toBe(true);
  });

  it('detects mismatched Spec ID in traceability comments', () => {
    const result = checker.check({
      specId: 'SPEC-LOGIN-001',
      approvedTestCaseIds: ['TC-LOGIN-001'],
      executedTests: [
        {
          testCaseId: 'TC-LOGIN-001',
          title: 'TC-LOGIN-001: Valid login',
          status: 'passed',
          durationMs: 300,
        },
      ],
      testFileContents: [
        {
          path: 'web/tests/foreign.spec.ts',
          content: `// Spec ID: SPEC-FOREIGN-999\n// Test Case ID: TC-FOREIGN-001\ntest('...', () => {});`,
        },
      ],
    });

    expect(result.passed).toBe(false);
    expect(result.unmapped).toContain('TC-FOREIGN-001');
  });
});
