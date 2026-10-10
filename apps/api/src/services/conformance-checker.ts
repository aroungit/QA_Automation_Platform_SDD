import type { ConformanceCheckResult, TestCaseExecutionResult } from '@qaa/shared';

export interface ConformanceCheckInput {
  specId: string;
  approvedTestCaseIds: string[];
  executedTests: TestCaseExecutionResult[];
  testFileContents?: { path: string; content: string }[];
}

export class ConformanceChecker {
  /**
   * Performs specification conformance checks (§3.6).
   * 1. Confirm every approved test case has a corresponding executed test.
   * 2. Confirm failed tests are not committed.
   * 3. Flag tests that pass but do not map to an approved specification.
   */
  check(input: ConformanceCheckInput): ConformanceCheckResult {
    const { specId, approvedTestCaseIds, executedTests, testFileContents } = input;
    const details: string[] = [];

    // Extract testCaseIds from executed tests
    const executedMap = new Map<string, TestCaseExecutionResult>();
    const executedTestCaseIds: string[] = [];
    const failedTests: string[] = [];

    for (const test of executedTests) {
      executedMap.set(test.testCaseId, test);
      if (!executedTestCaseIds.includes(test.testCaseId)) {
        executedTestCaseIds.push(test.testCaseId);
      }

      if (test.status === 'failed' || test.status === 'timedOut') {
        failedTests.push(test.testCaseId);
        details.push(
          `Test "${test.testCaseId}" failed execution with status "${test.status}". Failed tests cannot be committed (§3.6).`,
        );
      }
    }

    // Also inspect test file contents for traceability comments if provided
    const fileTraceabilityMap = new Map<string, { specId?: string; title?: string }>();
    if (testFileContents && testFileContents.length > 0) {
      for (const file of testFileContents) {
        if (!file.path.includes('/tests/')) continue;

        const specMatch = /\/\/\s*Spec ID:\s*([^\r\n]+)/i.exec(file.content);
        const tcMatch = /\/\/\s*Test Case ID:\s*([^\r\n]+)/i.exec(file.content);
        const titleMatch = /\/\/\s*Source:\s*([^\r\n]+)/i.exec(file.content);

        if (tcMatch && tcMatch[1]) {
          const tcId = tcMatch[1].trim();
          fileTraceabilityMap.set(tcId, {
            specId: specMatch?.[1]?.trim(),
            title: titleMatch?.[1]?.trim(),
          });
        }
      }
    }

    // 1. Covered vs Missing
    const covered: string[] = [];
    const missing: string[] = [];

    for (const approvedId of approvedTestCaseIds) {
      const exec = executedMap.get(approvedId);
      if (exec) {
        if (exec.status === 'passed') {
          covered.push(approvedId);
          details.push(`Approved test case "${approvedId}" is covered and passed.`);
        } else {
          // It was executed but failed
          details.push(
            `Approved test case "${approvedId}" was executed but did not pass (status: ${exec.status}).`,
          );
        }
      } else {
        missing.push(approvedId);
        details.push(
          `Approved test case "${approvedId}" has no corresponding executed test script (§3.6).`,
        );
      }
    }

    // 2. Unmapped tests (executed or scripted tests that do NOT map to approved test cases)
    const unmapped: string[] = [];

    for (const execId of executedTestCaseIds) {
      if (!approvedTestCaseIds.includes(execId)) {
        unmapped.push(execId);
        details.push(
          `Executed test "${execId}" does not map to any approved test case in specification "${specId}" (§3.6).`,
        );
      }
    }

    // Also check files with mismatched Spec ID
    for (const [tcId, trace] of fileTraceabilityMap.entries()) {
      if (trace.specId && trace.specId !== specId) {
        if (!unmapped.includes(tcId)) {
          unmapped.push(tcId);
          details.push(
            `Test script "${tcId}" references Spec ID "${trace.specId}", which does not match active specification "${specId}".`,
          );
        }
      }
    }

    // SDD Rule: All approved test cases must be covered, zero unmapped, zero failed
    const passed = missing.length === 0 && unmapped.length === 0 && failedTests.length === 0;

    return {
      passed,
      approvedTestCaseIds,
      executedTestCaseIds,
      covered,
      missing,
      unmapped,
      failedTests,
      details,
    };
  }
}
