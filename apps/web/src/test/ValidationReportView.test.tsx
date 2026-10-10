import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ValidationReport } from '@qaa/shared';
import { ValidationReportView } from '../components/validation/ValidationReportView';

describe('ValidationReportView component (§W4)', () => {
  const mockReport: ValidationReport = {
    reportId: 'VAL-SPEC-LOGIN-001-999',
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
        validCount: 4,
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
      durationMs: 350,
      mode: 'simulated',
      tests: [
        {
          testCaseId: 'TC-LOGIN-001',
          title: 'Verify Successful Admin Login Flow',
          status: 'passed',
          durationMs: 350,
          consoleLogs: ['Navigated to login', 'Logged in successfully'],
        },
      ],
      artifacts: { screenshots: [], traces: [], reports: [] },
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
    metadata: {
      targetApp: 'OrangeHRM',
      executionMode: 'simulated',
    },
  };

  it('renders report ID, status badge, and dynamic test execution results', () => {
    render(<ValidationReportView report={mockReport} />);

    expect(screen.getByText('VAL-SPEC-LOGIN-001-999')).toBeInTheDocument();
    expect(screen.getByText('PASSED')).toBeInTheDocument();
    expect(screen.getByText(/Eligible for Promotion/i)).toBeInTheDocument();

    // Check test execution details
    expect(screen.getByText('TC-LOGIN-001')).toBeInTheDocument();
    expect(screen.getByText('Verify Successful Admin Login Flow')).toBeInTheDocument();
  });

  it('switches tabs to inspect static code analysis and locators', () => {
    render(<ValidationReportView report={mockReport} />);

    // Click Static Analysis tab
    const staticTab = screen.getByRole('button', { name: /static analysis/i });
    fireEvent.click(staticTab);

    expect(
      screen.getByRole('heading', { name: /typescript compilation/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Selector Stability & Locator Analysis/i)).toBeInTheDocument();
    expect(screen.getByText("getByRole('button')")).toBeInTheDocument();
  });

  it('switches tabs to inspect specification conformance', () => {
    render(<ValidationReportView report={mockReport} />);

    // Click Spec Conformance tab
    const conformanceTab = screen.getByRole('button', { name: /spec conformance/i });
    fireEvent.click(conformanceTab);

    expect(
      screen.getByText(/100% Traceability & Coverage Assurance/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/100% Conforming/i)).toBeInTheDocument();
  });
});
