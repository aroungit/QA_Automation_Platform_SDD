import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SpecDetailPage } from '../pages/SpecDetailPage';
import { LLMProviderComponent } from '../providers/LLMContext';
import { api } from '../services/api';

describe('SpecDetailPage component (§W2)', () => {
  it('loads specification by ID and renders tabs and details', async () => {
    await act(async () => {
      render(
        <LLMProviderComponent>
          <MemoryRouter initialEntries={['/specs/SPEC-LOGIN-001']}>
            <Routes>
              <Route path="/specs/:specId" element={<SpecDetailPage />} />
            </Routes>
          </MemoryRouter>
        </LLMProviderComponent>,
      );
    });

    await waitFor(() => {
      expect(screen.getAllByText('SPEC-LOGIN-001').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Admin Authentication Specification')).toBeInTheDocument();
    });

    // Verify Specification tab content
    expect(screen.getByText(/verify secure authentication of admin users/i)).toBeInTheDocument();

    // Switch to Test Cases tab
    const testCasesTab = screen.getByRole('button', { name: /^test cases \(§3\.3\)/i });
    fireEvent.click(testCasesTab);

    expect(screen.getAllByText('Successful Admin Login').length).toBeGreaterThanOrEqual(1);

    // Switch to User Story tab
    const userStoryTab = screen.getByRole('button', { name: /source user story/i });
    fireEvent.click(userStoryTab);

    expect(screen.getByText('Original User Story & Intake Metadata (§3.1)')).toBeInTheDocument();
    expect(screen.getByText('As an Admin, I want to log in...')).toBeInTheDocument();

    // Switch to Artifact Files tab
    const filesTab = screen.getByRole('button', { name: /artifact files/i });
    fireEvent.click(filesTab);

    expect(screen.getByText(/user-story.md/)).toBeInTheDocument();
    expect(screen.getByText(/specification.md/)).toBeInTheDocument();
  });

  it('displays error state when specification is not found', async () => {
    vi.spyOn(api, 'getSpec').mockRejectedValueOnce(
      new Error('Specification "SPEC-NOTFOUND" not found'),
    );

    await act(async () => {
      render(
        <LLMProviderComponent>
          <MemoryRouter initialEntries={['/specs/SPEC-NOTFOUND']}>
            <Routes>
              <Route path="/specs/:specId" element={<SpecDetailPage />} />
            </Routes>
          </MemoryRouter>
        </LLMProviderComponent>,
      );
    });

    await waitFor(() => {
      expect(screen.getByText('Specification Error')).toBeInTheDocument();
      expect(screen.getByText(/Specification "SPEC-NOTFOUND" not found/i)).toBeInTheDocument();
    });
  });
});
