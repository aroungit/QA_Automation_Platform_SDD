import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ValidationReport } from '@qaa/shared';
import { PipelineStepper } from '../components/validation/PipelineStepper';

describe('PipelineStepper component (§W4)', () => {
  const mockReport: ValidationReport = {
    reportId: 'VAL-SPEC-LOGIN-001-12345',
    specId: 'SPEC-LOGIN-001',
    timestamp: '2026-10-10T12:00:00.000Z',
    platform: 'web',
    overallStatus: 'PASSED',
    eligibleForPromotion: true,
    staticValidation: {
      passed: true,
      typeScriptCheck: { passed: true, errors: [] },
      lintCheck: { passed: true, errors: [], warnings: [] },
      selectorValidation: {
        passed: true,
        validCount: 8,
        warnings: [],
        locatorsFound: ["getByRole('button')"],
      },
      importValidation: { passed: true, errors: [], imports: ['@playwright/test'] },
    },
    dynamicValidation: {
      passed: true,
      executed: true,
      totalTests: 5,
      passedCount: 5,
      failedCount: 0,
      skippedCount: 0,
      durationMs: 820,
      mode: 'simulated',
      tests: [],
      artifacts: { screenshots: [], traces: [], reports: [] },
    },
    conformanceCheck: {
      passed: true,
      approvedTestCaseIds: ['TC-LOGIN-001', 'TC-LOGIN-002'],
      executedTestCaseIds: ['TC-LOGIN-001', 'TC-LOGIN-002'],
      covered: ['TC-LOGIN-001', 'TC-LOGIN-002'],
      missing: [],
      unmapped: [],
      failedTests: [],
      details: ['All test cases passed'],
    },
    metadata: { targetApp: 'OrangeHRM', executionMode: 'simulated' },
  };

  it('renders all 5 validation stages with passed status indicators', () => {
    render(<PipelineStepper report={mockReport} isRunning={false} />);

    expect(screen.getByText(/Static Analysis/i)).toBeInTheDocument();
    expect(screen.getByText(/Dynamic Execution/i)).toBeInTheDocument();
    expect(screen.getByText(/Spec Conformance/i)).toBeInTheDocument();
    expect(screen.getByText(/Auto-Healing Gate/i)).toBeInTheDocument();
    expect(screen.getByText(/Release Quality Gate/i)).toBeInTheDocument();

    // Check metric details
    expect(screen.getByText(/8 selectors verified/i)).toBeInTheDocument();
    expect(screen.getByText(/5\/5 passed \(820ms\)/i)).toBeInTheDocument();
    expect(screen.getByText(/2\/2 approved TCs covered/i)).toBeInTheDocument();
  });

  it('shows running animation when isRunning is true', () => {
    render(<PipelineStepper report={null} isRunning={true} activeStage={2} />);

    expect(screen.getByText(/Running.../i)).toBeInTheDocument();
  });
});
