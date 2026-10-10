import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { ThemeProvider, useTheme } from '../theme/ThemeContext';

const TestComponent: React.FC = () => {
  const { theme, resolvedTheme, toggleTheme, setTheme } = useTheme();
  return (
    <div>
      <span data-testid="theme-val">{theme}</span>
      <span data-testid="resolved-val">{resolvedTheme}</span>
      <button onClick={toggleTheme}>Toggle</button>
      <button onClick={() => setTheme('dark')}>SetDark</button>
      <button onClick={() => setTheme('light')}>SetLight</button>
    </div>
  );
};

describe('ThemeContext (§W1)', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
  });

  it('defaults to system theme and respects dark/light toggle', () => {
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>,
    );

    const themeVal = screen.getByTestId('theme-val');
    expect(themeVal.textContent).toBe('system');

    // Toggle theme
    const toggleBtn = screen.getByText('Toggle');
    fireEvent.click(toggleBtn);

    const resolvedVal = screen.getByTestId('resolved-val');
    expect(['light', 'dark']).toContain(resolvedVal.textContent);
  });

  it('persists selected theme in localStorage', () => {
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>,
    );

    const setDarkBtn = screen.getByText('SetDark');
    fireEvent.click(setDarkBtn);

    expect(localStorage.getItem('qaa-theme')).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    const setLightBtn = screen.getByText('SetLight');
    fireEvent.click(setLightBtn);

    expect(localStorage.getItem('qaa-theme')).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });
});
