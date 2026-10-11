import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ValidationPage } from '../pages/ValidationPage';
import { LLMProviderComponent } from '../providers/LLMContext';
import { api } from '../services/api';

describe('ValidationPage (§W4)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders pipeline stepper, run controls, and validation reports', async () => {
    await act(async () => {
      render(
        <LLMProviderComponent>
          <BrowserRouter>
            <ValidationPage />
          </BrowserRouter>
        </LLMProviderComponent>,
      );
    });

    await waitFor(() => {
      expect(screen.getByText(/Automated Validation, Runs & Reports/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/select specification/i)).toBeInTheDocument();
      expect(screen.getByText(/Pipeline Controls/i)).toBeInTheDocument();
    });

    // Check pipeline stages
    expect(screen.getAllByText(/Static Analysis/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Dynamic Execution/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Spec Conformance/i).length).toBeGreaterThan(0);

    // Check action buttons
    expect(screen.getByRole('button', { name: /run validation pipeline/i })).toBeInTheDocument();
  });

  it('triggers pipeline execution and shows success notification when approved', async () => {
    vi.spyOn(api, 'getSpec').mockResolvedValue({
      specId: 'SPEC-LOGIN-001',
      approvalRecord: {
        specId: 'SPEC-LOGIN-001',
        status: 'Approved',
        reviewer: 'Admin',
        comments: 'Ready for validation',
        approvedTestCases: ['TC-LOGIN-001'],
        timestamp: '2026-10-10T00:00:00.000Z',
      },
      files: ['user-story.md', 'specification.md', 'test-cases.md'],
    });

    vi.spyOn(api, 'listWorkspaceFiles').mockResolvedValue({
      files: ['web/tests/SPEC-LOGIN-001/TC-LOGIN-001.spec.ts', 'playwright.config.ts'],
      workspaceDir: 'D:/.workspace',
    });

    vi.spyOn(api, 'validateSpec').mockResolvedValue({
      reportId: 'VAL-SPEC-LOGIN-001-TEST',
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
          locatorsFound: ["getByRole('button')"],
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
        durationMs: 300,
        mode: 'simulated',
        tests: [
          {
            testCaseId: 'TC-LOGIN-001',
            title: 'Successful Admin Login',
            status: 'passed',
            durationMs: 300,
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
        details: ['All test cases passed'],
      },
      metadata: { targetApp: 'OrangeHRM', executionMode: 'simulated' },
    });

    await act(async () => {
      render(
        <LLMProviderComponent>
          <BrowserRouter>
            <ValidationPage />
          </BrowserRouter>
        </LLMProviderComponent>,
      );
    });

    await waitFor(() => {
      const runBtn = screen.getByRole('button', { name: /run validation pipeline/i });
      expect(runBtn).not.toBeDisabled();
    });

    const runBtn = screen.getByRole('button', { name: /run validation pipeline/i });
    await act(async () => {
      fireEvent.click(runBtn);
    });

    await waitFor(() => {
      expect(screen.getByText(/Validation PASSED!/i)).toBeInTheDocument();
    });
  });
});
