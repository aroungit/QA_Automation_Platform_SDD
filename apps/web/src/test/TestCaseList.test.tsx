import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { TestCase } from '@qaa/shared';
import { TestCaseList } from '../components/spec/TestCaseList';

const mockTestCases: TestCase[] = [
  {
    id: 'TC-LOGIN-001',
    specId: 'SPEC-LOGIN-001',
    title: 'Valid Admin Credentials Redirects to Dashboard',
    preconditions: ['Browser open on OrangeHRM login page'],
    testSteps: [
      { stepNumber: 1, action: 'Type admin in Username', expectedResult: 'Username filled' },
      { stepNumber: 2, action: 'Type password in Password', expectedResult: 'Password filled' },
      { stepNumber: 3, action: 'Click Login', expectedResult: 'Dashboard URL reached' },
    ],
    expectedResults: ['User is authenticated', 'Dashboard header rendered'],
    priority: 'critical',
    testType: 'functional',
    targetPlatform: 'web',
    automationSuitability: 'automatable',
  },
  {
    id: 'TC-LOGIN-002',
    specId: 'SPEC-LOGIN-001',
    title: 'Invalid Credentials Displays Error Message',
    preconditions: ['Browser open on OrangeHRM login page'],
    testSteps: [
      { stepNumber: 1, action: 'Type admin in Username', expectedResult: 'Username filled' },
      { stepNumber: 2, action: 'Type wrongpass in Password', expectedResult: 'Password filled' },
      { stepNumber: 3, action: 'Click Login', expectedResult: 'Error message appears' },
    ],
    expectedResults: ['Error banner shown', 'User remains on login page'],
    priority: 'high',
    testType: 'negative',
    targetPlatform: 'web',
    automationSuitability: 'automatable',
  },
  {
    id: 'TC-LOGIN-003',
    specId: 'SPEC-LOGIN-001',
    title: 'Manual Visual Branding Check',
    preconditions: ['Physical mobile device'],
    testSteps: [
      { stepNumber: 1, action: 'Check company logo aspect ratio', expectedResult: 'No distortion' },
    ],
    expectedResults: ['Logo satisfies design specs'],
    priority: 'low',
    testType: 'accessibility',
    targetPlatform: 'mobile',
    automationSuitability: 'manual-only',
  },
];

describe('TestCaseList component (§W2)', () => {
  it('renders test cases list in desktop table and mobile cards', () => {
    render(<TestCaseList testCases={mockTestCases} specId="SPEC-LOGIN-001" />);

    // Check test cases are present
    expect(screen.getAllByText('TC-LOGIN-001').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('TC-LOGIN-002').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('TC-LOGIN-003').length).toBeGreaterThanOrEqual(1);

    // Verify counter
    expect(screen.getByText(/showing/i)).toHaveTextContent('3 of 3 Test Cases');
  });

  it('filters test cases by priority, test type, and search query', () => {
    render(<TestCaseList testCases={mockTestCases} specId="SPEC-LOGIN-001" />);

    // Filter by priority: critical
    const prioritySelect = screen.getByLabelText(/filter by priority/i);
    fireEvent.change(prioritySelect, { target: { value: 'critical' } });

    expect(screen.getAllByText('TC-LOGIN-001').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText('TC-LOGIN-002')).not.toBeInTheDocument();
    expect(screen.queryByText('TC-LOGIN-003')).not.toBeInTheDocument();

    // Reset priority filter
    fireEvent.change(prioritySelect, { target: { value: 'all' } });

    // Filter by test type: negative
    const typeSelect = screen.getByLabelText(/filter by test type/i);
    fireEvent.change(typeSelect, { target: { value: 'negative' } });

    expect(screen.queryByText('TC-LOGIN-001')).not.toBeInTheDocument();
    expect(screen.getAllByText('TC-LOGIN-002').length).toBeGreaterThanOrEqual(1);

    // Search query
    fireEvent.change(typeSelect, { target: { value: 'all' } });
    const searchInput = screen.getByLabelText(/search candidate test cases/i);
    fireEvent.change(searchInput, { target: { value: 'Branding' } });

    expect(screen.queryByText('TC-LOGIN-001')).not.toBeInTheDocument();
    expect(screen.getAllByText('TC-LOGIN-003').length).toBeGreaterThanOrEqual(1);
  });

  it('opens test case detail modal with execution steps and traceability comments', () => {
    render(<TestCaseList testCases={mockTestCases} specId="SPEC-LOGIN-001" />);

    // Click "Details" or row for TC-LOGIN-001
    const detailBtns = screen.getAllByRole('button', { name: /details/i });
    fireEvent.click(detailBtns[0]!);

    // Modal dialog opens
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();

    // Verify steps and traceability
    expect(screen.getByText('Type admin in Username')).toBeInTheDocument();
    expect(screen.getByText('Traceability Comment Header (§3.5)')).toBeInTheDocument();
    expect(screen.getByText(/Spec ID: SPEC-LOGIN-001/)).toBeInTheDocument();

    // Close modal
    const closeBtn = screen.getByRole('button', { name: 'Close test case details' });
    fireEvent.click(closeBtn);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
