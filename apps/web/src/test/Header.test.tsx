import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Header } from '../components/layout/Header';
import { LLMProviderComponent } from '../providers/LLMContext';
import { ThemeProvider } from '../theme/ThemeContext';

describe('Header component (§W1)', () => {
  it('renders application title, logo, provider selector, and theme toggle', async () => {
    const toggleMobile = vi.fn();

    await act(async () => {
      render(
        <ThemeProvider>
          <LLMProviderComponent>
            <BrowserRouter>
              <Header mobileMenuOpen={false} onToggleMobileMenu={toggleMobile} />
            </BrowserRouter>
          </LLMProviderComponent>
        </ThemeProvider>,
      );
    });

    // Title and Logo
    expect(screen.getByText('QA_Automation_Platform_Agent')).toBeInTheDocument();
    expect(screen.getByAltText('QAA Logo')).toBeInTheDocument();

    // LLM Provider select
    const providerSelect = screen.getByLabelText(/select llm provider/i) as HTMLSelectElement;
    expect(providerSelect).toBeInTheDocument();
    expect(providerSelect.value).toBe('groq');

    // Change provider to cohere
    fireEvent.change(providerSelect, { target: { value: 'cohere' } });
    expect(providerSelect.value).toBe('cohere');

    // Theme toggle button
    const themeBtn = screen.getByTitle(/switch to/i);
    expect(themeBtn).toBeInTheDocument();

    // Mobile menu button
    const mobileBtn = screen.getByLabelText(/open navigation menu/i);
    fireEvent.click(mobileBtn);
    expect(toggleMobile).toHaveBeenCalledTimes(1);
  });
});
