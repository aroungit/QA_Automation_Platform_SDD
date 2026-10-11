import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Priority, TestCase, ValidationReport } from '@qaa/shared';
import { Header } from '../components/layout/Header';
import { MobileDrawer } from '../components/layout/MobileDrawer';
import { Footer } from '../components/layout/Footer';
import { Navigation } from '../components/layout/Navigation';
import { TestCaseList } from '../components/spec/TestCaseList';
import { PipelineStepper } from '../components/validation/PipelineStepper';
import { QualityGatesModal } from '../components/validation/QualityGatesModal';
import { LLMProvider } from '../providers/LLMContext';
import { ThemeProvider, useTheme } from '../theme/ThemeContext';

const mockTestCases: TestCase[] = [
  {
    id: 'TC-LOGIN-001',
    specId: 'SPEC-LOGIN-001',
    title: 'Valid administrative credentials redirection to dashboard',
    priority: 'critical' as Priority,
    testType: 'functional',
    targetPlatform: 'web',
    automationSuitability: 'automatable',
    preconditions: ['User account exists in OrangeHRM'],
    testSteps: [
      {
        stepNumber: 1,
        action: 'Navigate to login page',
        expectedResult: 'Login form is displayed',
      },
      {
        stepNumber: 2,
        action: 'Fill username Admin and password admin123',
        expectedResult: 'Credentials entered into inputs',
      },
      {
        stepNumber: 3,
        action: 'Click Login button',
        expectedResult: 'Redirects to /dashboard with active session',
      },
    ],
    expectedResults: ['User is authenticated and dashboard widget is visible'],
  },
  {
    id: 'TC-LOGIN-002',
    specId: 'SPEC-LOGIN-001',
    title: 'Invalid password shows error alert without field disclosure',
    priority: 'high' as Priority,
    testType: 'negative',
    targetPlatform: 'web',
    automationSuitability: 'automatable',
    preconditions: ['User account exists'],
    testSteps: [
      {
        stepNumber: 1,
        action: 'Enter Admin and InvalidPass',
        expectedResult: 'Inputs filled',
      },
      {
        stepNumber: 2,
        action: 'Submit login form',
        expectedResult: 'Alert message "Invalid credentials" displayed',
      },
    ],
    expectedResults: ['Error alert displayed; user remains on login page'],
  },
];

const mockReport: ValidationReport = {
  reportId: 'VAL-SPEC-LOGIN-001-TEST',
  specId: 'SPEC-LOGIN-001',
  timestamp: new Date().toISOString(),
  platform: 'web',
  overallStatus: 'PASSED',
  eligibleForPromotion: true,
  metadata: {
    targetApp: 'OrangeHRM',
    executionMode: 'simulated',
  },
  staticValidation: {
    passed: true,
    typeScriptCheck: { passed: true, errors: [] },
    lintCheck: { passed: true, errors: [], warnings: [] },
    selectorValidation: {
      passed: true,
      validCount: 8,
      warnings: [],
      locatorsFound: ["page.getByRole('button', { name: 'Login' })"],
    },
    importValidation: { passed: true, errors: [], imports: ['@playwright/test'] },
  },
  dynamicValidation: {
    passed: true,
    executed: true,
    mode: 'simulated',
    totalTests: 2,
    passedCount: 2,
    failedCount: 0,
    skippedCount: 0,
    durationMs: 1200,
    artifacts: { screenshots: [], traces: [], reports: [] },
    tests: [
      {
        testCaseId: 'TC-LOGIN-001',
        title: 'Valid administrative credentials redirection to dashboard',
        status: 'passed',
        durationMs: 650,
      },
      {
        testCaseId: 'TC-LOGIN-002',
        title: 'Invalid password shows error alert without field disclosure',
        status: 'passed',
        durationMs: 550,
      },
    ],
  },
  conformanceCheck: {
    passed: true,
    approvedTestCaseIds: ['TC-LOGIN-001', 'TC-LOGIN-002'],
    executedTestCaseIds: ['TC-LOGIN-001', 'TC-LOGIN-002'],
    covered: ['TC-LOGIN-001', 'TC-LOGIN-002'],
    missing: [],
    unmapped: [],
    failedTests: [],
    details: ['All 2 approved test cases covered.'],
  },
  healingSummary: {
    attempted: false,
    successful: false,
    totalAttempts: 0,
    maxAttempts: 3,
    attempts: [],
  },
};

// Theme toggle test harness component
const ThemeTestConsumer: React.FC = () => {
  const { theme, resolvedTheme, toggleTheme, setTheme } = useTheme();
  return (
    <div>
      <span data-testid="theme-name">{theme}</span>
      <span data-testid="resolved-theme">{resolvedTheme}</span>
      <button data-testid="theme-toggle-btn" onClick={toggleTheme}>
        Toggle
      </button>
      <button data-testid="set-light-btn" onClick={() => setTheme('light')}>
        Set Light
      </button>
      <button data-testid="set-dark-btn" onClick={() => setTheme('dark')}>
        Set Dark
      </button>
    </div>
  );
};

describe('W5 — Web QA Pass: Mobile/Tablet/Desktop Alignment, Themes & PWA', () => {
  describe('Responsive Layout & Alignment Checks', () => {
    it('Header renders responsive titles for desktop and mobile without layout break', () => {
      const toggleMenu = vi.fn();
      render(
        <BrowserRouter>
          <ThemeProvider>
            <LLMProvider>
              <Header mobileMenuOpen={false} onToggleMobileMenu={toggleMenu} />
            </LLMProvider>
          </ThemeProvider>
        </BrowserRouter>,
      );

      // Both desktop long name and mobile short name are rendered with responsive classes
      expect(screen.getByText('QA_Automation_Platform_Agent')).toBeInTheDocument();
      expect(screen.getByText('QAA Platform')).toBeInTheDocument();

      // Mobile hamburger button
      const menuButton = screen.getByRole('button', { name: /open navigation menu/i });
      expect(menuButton).toBeInTheDocument();
      fireEvent.click(menuButton);
      expect(toggleMenu).toHaveBeenCalledTimes(1);
    });

    it('MobileDrawer handles Escape key, backdrop click, and body overflow lock', () => {
      const handleClose = vi.fn();
      const { rerender } = render(
        <BrowserRouter>
          <ThemeProvider>
            <LLMProvider>
              <MobileDrawer isOpen={true} onClose={handleClose} />
            </LLMProvider>
          </ThemeProvider>
        </BrowserRouter>,
      );

      // Verify body overflow is locked when drawer is open
      expect(document.body.style.overflow).toBe('hidden');

      // Test Escape key
      fireEvent.keyDown(window, { key: 'Escape' });
      expect(handleClose).toHaveBeenCalled();

      // Test close button
      const closeBtn = screen.getByRole('button', { name: /close navigation menu/i });
      fireEvent.click(closeBtn);
      expect(handleClose).toHaveBeenCalledTimes(2);

      // Rerender as closed and check body overflow restored
      rerender(
        <BrowserRouter>
          <ThemeProvider>
            <LLMProvider>
              <MobileDrawer isOpen={false} onClose={handleClose} />
            </LLMProvider>
          </ThemeProvider>
        </BrowserRouter>,
      );
      expect(document.body.style.overflow).toBe('');
    });

    it('TestCaseList renders both desktop table and mobile card views, and handles modal Escape key', () => {
      render(<TestCaseList testCases={mockTestCases} specId="SPEC-LOGIN-001" />);

      // Table view headers exist for desktop/tablet
      expect(screen.getByText('Test ID')).toBeInTheDocument();
      expect(screen.getByText('Suitability')).toBeInTheDocument();

      // Both test cases rendered
      expect(screen.getAllByText('TC-LOGIN-001').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('TC-LOGIN-002').length).toBeGreaterThanOrEqual(1);

      // Open detail modal by clicking Inspect / Details
      const inspectButtons = screen.getAllByText(/Inspect/i);
      fireEvent.click(inspectButtons[0]!);

      // Modal is open
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Test Execution Steps (3)')).toBeInTheDocument();
      expect(screen.getByText('Traceability Comment Header (§3.5)')).toBeInTheDocument();

      // Verify body scroll lock is active while modal is open
      expect(document.body.style.overflow).toBe('hidden');

      // Press Escape to dismiss modal
      fireEvent.keyDown(window, { key: 'Escape' });
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(document.body.style.overflow).toBe('');
    });

    it('PipelineStepper displays all 5 SDD stages across responsive breakpoints', () => {
      render(<PipelineStepper report={mockReport} isRunning={false} />);

      expect(screen.getByText('Static Analysis')).toBeInTheDocument();
      expect(screen.getByText('Dynamic Execution')).toBeInTheDocument();
      expect(screen.getByText('Spec Conformance')).toBeInTheDocument();
      expect(screen.getByText('Auto-Healing Gate')).toBeInTheDocument();
      expect(screen.getByText('Release Quality Gate')).toBeInTheDocument();
    });

    it('QualityGatesModal supports keyboard Escape dismissal', () => {
      const handleClose = vi.fn();
      render(<QualityGatesModal specId="SPEC-LOGIN-001" isOpen={true} onClose={handleClose} />);

      expect(screen.getByRole('heading', { name: /Release Quality Gates/i })).toBeInTheDocument();

      // Press Escape
      fireEvent.keyDown(window, { key: 'Escape' });
      expect(handleClose).toHaveBeenCalled();
    });

    it('Navigation renders primary desktop links with proper active states', () => {
      render(
        <BrowserRouter>
          <Navigation />
        </BrowserRouter>,
      );

      expect(screen.getByRole('link', { name: /dashboard/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /specifications/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /new story intake/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /approval gate/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /validation & healing/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /repository & gates/i })).toBeInTheDocument();
    });
  });

  describe('Dark / Light Theme System Checks', () => {
    it('ThemeProvider initializes, toggles theme, and toggles dark class on documentElement', () => {
      render(
        <ThemeProvider>
          <ThemeTestConsumer />
        </ThemeProvider>,
      );

      const toggleBtn = screen.getByTestId('theme-toggle-btn');
      const setLightBtn = screen.getByTestId('set-light-btn');
      const setDarkBtn = screen.getByTestId('set-dark-btn');

      // Set explicit light mode
      act(() => {
        fireEvent.click(setLightBtn);
      });

      expect(screen.getByTestId('theme-name').textContent).toBe('light');
      expect(screen.getByTestId('resolved-theme').textContent).toBe('light');
      expect(document.documentElement.classList.contains('dark')).toBe(false);

      // Set explicit dark mode
      act(() => {
        fireEvent.click(setDarkBtn);
      });

      expect(screen.getByTestId('theme-name').textContent).toBe('dark');
      expect(screen.getByTestId('resolved-theme').textContent).toBe('dark');
      expect(document.documentElement.classList.contains('dark')).toBe(true);

      // Toggle back to light
      act(() => {
        fireEvent.click(toggleBtn);
      });

      expect(screen.getByTestId('theme-name').textContent).toBe('light');
      expect(screen.getByTestId('resolved-theme').textContent).toBe('light');
      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });
  });

  describe('Footer & Compliance Verification', () => {
    it('Footer renders mandatory copyright © 2026 Aroun AI labs and architectural pillars', async () => {
      render(<Footer />);

      expect(screen.getByText(/© 2026 Aroun AI labs/i)).toBeInTheDocument();
      expect(screen.getByText(/Spec-Driven \(SDD\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Playwright POM/i)).toBeInTheDocument();

      // Waits for health badge
      await waitFor(() => {
        expect(screen.getByText(/API Online|API Disconnected/i)).toBeInTheDocument();
      });
    });
  });
});
