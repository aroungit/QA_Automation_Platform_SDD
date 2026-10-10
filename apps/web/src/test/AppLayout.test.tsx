import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AppLayout } from '../components/layout/AppLayout';
import { LLMProviderComponent } from '../providers/LLMContext';
import { ThemeProvider } from '../theme/ThemeContext';

describe('AppLayout component (§W1)', () => {
  it('renders skip link, header, navigation, and footer', async () => {
    await act(async () => {
      render(
        <ThemeProvider>
          <LLMProviderComponent>
            <BrowserRouter>
              <AppLayout />
            </BrowserRouter>
          </LLMProviderComponent>
        </ThemeProvider>,
      );
    });

    // Skip to main content link
    const skipLink = screen.getByText('Skip to main content');
    expect(skipLink).toBeInTheDocument();
    expect(skipLink).toHaveAttribute('href', '#main-content');

    // Header title
    expect(screen.getAllByText(/QA_Automation_Platform_Agent/i).length).toBeGreaterThanOrEqual(1);

    // Footer
    expect(screen.getByText(/© 2026 Aroun AI labs/)).toBeInTheDocument();

    // Open mobile drawer
    const openMenuBtn = screen.getByLabelText(/open navigation menu/i);
    fireEvent.click(openMenuBtn);

    // Verify drawer dialog is open
    const drawer = screen.getByRole('dialog', { name: /navigation menu/i });
    expect(drawer).toBeInTheDocument();

    // Close drawer
    const closeBtns = screen.getAllByLabelText(/close navigation menu/i);
    fireEvent.click(closeBtns[0]!);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
