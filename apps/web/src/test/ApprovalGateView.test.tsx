import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ApprovalGateView } from '../components/approval/ApprovalGateView';
import { LLMProviderComponent } from '../providers/LLMContext';
import { api } from '../services/api';

describe('ApprovalGateView component (§W3)', () => {
  it('renders specification selector, candidate test cases, and status badges', async () => {
    await act(async () => {
      render(
        <LLMProviderComponent>
          <BrowserRouter>
            <ApprovalGateView />
          </BrowserRouter>
        </LLMProviderComponent>,
      );
    });

    await waitFor(() => {
      expect(screen.getByLabelText(/specification to review/i)).toBeInTheDocument();
      expect(screen.getByText('SPEC-LOGIN-001')).toBeInTheDocument();
      expect(screen.getByText('Successful Admin Login')).toBeInTheDocument();
    });

    // Check decision action buttons exist
    expect(
      screen.getByRole('button', { name: /approve selected test cases/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /needs clarification/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reject test cases/i })).toBeInTheDocument();

    // Check audit history header
    expect(screen.getByText(/approval audit trail/i)).toBeInTheDocument();
  });

  it('validates mandatory reviewer comments when requesting clarification or rejecting', async () => {
    await act(async () => {
      render(
        <LLMProviderComponent>
          <BrowserRouter>
            <ApprovalGateView />
          </BrowserRouter>
        </LLMProviderComponent>,
      );
    });

    await waitFor(() => {
      expect(screen.getByText('Successful Admin Login')).toBeInTheDocument();
    });

    // Attempt rejection with empty comments
    const rejectBtn = screen.getByRole('button', { name: /reject test cases/i });
    fireEvent.click(rejectBtn);

    expect(
      screen.getByText(/reviewer comments are mandatory when marking "rejected"/i),
    ).toBeInTheDocument();
  });

  it('submits approval decision and updates state', async () => {
    const decisionSpy = vi.spyOn(api, 'submitApprovalDecision').mockResolvedValueOnce({
      specId: 'SPEC-LOGIN-001',
      status: 'Approved',
      reviewer: 'Lead QA Engineer',
      comments: 'All acceptance criteria covered',
      approvedTestCases: ['TC-LOGIN-001'],
      timestamp: '2026-10-10T00:00:00.000Z',
    });

    await act(async () => {
      render(
        <LLMProviderComponent>
          <BrowserRouter>
            <ApprovalGateView />
          </BrowserRouter>
        </LLMProviderComponent>,
      );
    });

    await waitFor(() => {
      expect(screen.getByText('Successful Admin Login')).toBeInTheDocument();
    });

    // Enter reviewer comments
    const commentsInput = screen.getByLabelText(/reviewer comments & notes/i);
    fireEvent.change(commentsInput, { target: { value: 'All acceptance criteria covered' } });

    // Click Approve
    const approveBtn = screen.getByRole('button', { name: /approve selected test cases/i });
    await act(async () => {
      fireEvent.click(approveBtn);
    });

    expect(decisionSpy).toHaveBeenCalledWith(
      'SPEC-LOGIN-001',
      expect.objectContaining({
        status: 'Approved',
        reviewer: 'Lead QA Engineer',
        approvedTestCases: expect.arrayContaining(['TC-LOGIN-001']),
      }),
    );
  });
});
