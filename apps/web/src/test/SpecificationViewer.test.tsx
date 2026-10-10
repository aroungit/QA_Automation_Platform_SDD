import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { SpecArtifactsPayload } from '@qaa/shared';
import { SpecificationViewer } from '../components/spec/SpecificationViewer';
import { LLMProviderComponent } from '../providers/LLMContext';

const mockSpecPayload: SpecArtifactsPayload = {
  specId: 'SPEC-LOGIN-001',
  specification: '# Specification\n\n## Business Objective\nVerify authentication flow.',
  specificationJson: {
    specId: 'SPEC-LOGIN-001',
    title: 'Admin Authentication Specification',
    businessObjective: 'Verify secure authentication of admin users.',
    actors: ['Administrator', 'HR Specialist'],
    preconditions: ['Browser open on OrangeHRM login page'],
    mainFlow: [
      { step: 1, action: 'Navigate to login', expected: 'Form visible' },
      { step: 2, action: 'Submit credentials', expected: 'Dashboard loaded' },
    ],
    alternateFlows: [{ name: 'Forgot Password Flow', steps: ['Click forgot link', 'Enter email'] }],
    exceptionFlows: [
      {
        name: 'Invalid Password',
        condition: 'Incorrect password entered',
        action: 'Display error banner',
      },
    ],
    dataRequirements: [
      { field: 'username', type: 'string', rules: 'Required, non-empty' },
      { field: 'password', type: 'string', rules: 'Required, min 8 chars' },
    ],
    acceptanceCriteria: ['Valid credentials redirect to dashboard'],
    nonFunctionalRequirements: ['Response time under 2s'],
    targetApp: 'OrangeHRM',
    environment: 'staging',
  },
  files: ['specification.md', 'specification.json'],
};

describe('SpecificationViewer component (§W2)', () => {
  it('renders structured specification sections, actors, flows, and data requirements', async () => {
    await act(async () => {
      render(
        <LLMProviderComponent>
          <BrowserRouter>
            <SpecificationViewer spec={mockSpecPayload} />
          </BrowserRouter>
        </LLMProviderComponent>,
      );
    });

    // Business objective
    expect(screen.getByText(/verify secure authentication of admin users/i)).toBeInTheDocument();

    // Actors
    expect(screen.getByText('Administrator')).toBeInTheDocument();
    expect(screen.getByText('HR Specialist')).toBeInTheDocument();

    // Main flow steps
    expect(screen.getByText('Navigate to login')).toBeInTheDocument();
    expect(screen.getByText('Submit credentials')).toBeInTheDocument();

    // Alternate flows & Exception flows
    expect(screen.getByText('Forgot Password Flow')).toBeInTheDocument();
    expect(screen.getByText('Invalid Password')).toBeInTheDocument();

    // Data requirements
    expect(screen.getByText('username')).toBeInTheDocument();
    expect(screen.getByText(/Required, non-empty/i)).toBeInTheDocument();
  });

  it('switches between structured view, raw markdown, and raw JSON', async () => {
    await act(async () => {
      render(
        <LLMProviderComponent>
          <BrowserRouter>
            <SpecificationViewer spec={mockSpecPayload} />
          </BrowserRouter>
        </LLMProviderComponent>,
      );
    });

    // Switch to Markdown tab
    const markdownTab = screen.getByRole('button', { name: /markdown/i });
    fireEvent.click(markdownTab);
    expect(screen.getByText('specification.md')).toBeInTheDocument();

    // Switch to JSON tab
    const jsonTab = screen.getByRole('button', { name: /json/i });
    fireEvent.click(jsonTab);
    expect(screen.getByText('specification.json')).toBeInTheDocument();
  });
});
