import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StorySubmissionForm } from '../components/intake/StorySubmissionForm';
import { LLMProviderComponent } from '../providers/LLMContext';
import { api } from '../services/api';

describe('StorySubmissionForm component (§W2)', () => {
  it('renders form fields, validates required inputs, and populates templates', async () => {
    await act(async () => {
      render(
        <LLMProviderComponent>
          <BrowserRouter>
            <StorySubmissionForm />
          </BrowserRouter>
        </LLMProviderComponent>,
      );
    });

    // Check key fields exist
    expect(screen.getByLabelText(/feature or story title/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/user story narrative/i)).toBeInTheDocument();
    expect(screen.getByText(/acceptance criteria/i)).toBeInTheDocument();

    // Trigger validation with empty inputs
    const submitBtn = screen.getByRole('button', { name: /submit story & generate/i });
    fireEvent.click(submitBtn);

    expect(screen.getByText('Title is required')).toBeInTheDocument();
    expect(screen.getByText('User story description is required')).toBeInTheDocument();

    // Click sample template "OrangeHRM Admin Login"
    const templateBtn = screen.getByText('OrangeHRM Admin Login');
    fireEvent.click(templateBtn);

    // Verify fields populated
    const titleInput = screen.getByLabelText(/feature or story title/i) as HTMLInputElement;
    expect(titleInput.value).toContain('Admin User Authentication');

    const storyInput = screen.getByLabelText(/user story narrative/i) as HTMLTextAreaElement;
    expect(storyInput.value).toContain('As a Human Resources Administrator');
  });

  it('allows adding and removing dynamic acceptance criteria', async () => {
    await act(async () => {
      render(
        <LLMProviderComponent>
          <BrowserRouter>
            <StorySubmissionForm />
          </BrowserRouter>
        </LLMProviderComponent>,
      );
    });

    // Add criterion
    const addBtn = screen.getByRole('button', { name: /add criterion/i });
    fireEvent.click(addBtn);

    expect(screen.getByPlaceholderText('Acceptance criterion 2...')).toBeInTheDocument();

    // Remove criterion
    const removeBtn = screen.getByLabelText(/remove criterion 2/i);
    fireEvent.click(removeBtn);

    expect(screen.queryByPlaceholderText('Acceptance criterion 2...')).not.toBeInTheDocument();
  });

  it('successfully submits intake and displays generated artifacts confirmation', async () => {
    const submitSpy = vi.spyOn(api, 'submitIntake');

    await act(async () => {
      render(
        <LLMProviderComponent>
          <BrowserRouter>
            <StorySubmissionForm />
          </BrowserRouter>
        </LLMProviderComponent>,
      );
    });

    // Fill sample template
    fireEvent.click(screen.getByText('OrangeHRM Admin Login'));

    // Submit
    const submitBtn = screen.getByRole('button', { name: /submit story & generate/i });
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    await waitFor(() => {
      expect(submitSpy).toHaveBeenCalled();
      expect(screen.getByText(/user story registered & artifacts generated!/i)).toBeInTheDocument();
    });

    expect(screen.getAllByText('SPEC-LOGIN-001').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/view specification & test cases/i)).toBeInTheDocument();
  });
});
