import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Header } from '../components/layout/Header';
import { MobileDrawer } from '../components/layout/MobileDrawer';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { LLMProvider } from '../providers/LLMContext';
import { ThemeProvider } from '../theme/ThemeContext';

describe('PWA Install and Manifest Verification (§W5)', () => {
  it('usePWAInstall hook captures beforeinstallprompt and handles installation workflow', async () => {
    const { result } = renderHook(() => usePWAInstall());

    expect(result.current.isInstallable).toBe(false);
    expect(result.current.isInstalled).toBe(false);

    // Create mock beforeinstallprompt event
    const promptMock = vi.fn().mockResolvedValue(undefined);
    const mockEvent = Object.assign(new Event('beforeinstallprompt'), {
      preventDefault: vi.fn(),
      prompt: promptMock,
      platforms: ['web'],
      userChoice: Promise.resolve({ outcome: 'accepted' as const, platform: 'web' }),
    });

    // Dispatch event
    act(() => {
      window.dispatchEvent(mockEvent);
    });

    expect(mockEvent.preventDefault).toHaveBeenCalled();
    expect(result.current.isInstallable).toBe(true);

    // Call promptInstall
    let outcome: string | undefined;
    await act(async () => {
      outcome = await result.current.promptInstall();
    });

    expect(promptMock).toHaveBeenCalled();
    expect(outcome).toBe('accepted');
    expect(result.current.isInstalled).toBe(true);
    expect(result.current.isInstallable).toBe(false);
  });

  it('usePWAInstall hook updates status when appinstalled event fires', () => {
    const { result } = renderHook(() => usePWAInstall());

    act(() => {
      window.dispatchEvent(new Event('appinstalled'));
    });

    expect(result.current.isInstalled).toBe(true);
    expect(result.current.isInstallable).toBe(false);
  });

  it('Header renders Install App button when beforeinstallprompt event is available', async () => {
    const mockEvent = Object.assign(new Event('beforeinstallprompt'), {
      preventDefault: vi.fn(),
      prompt: vi.fn().mockResolvedValue(undefined),
      platforms: ['web'],
      userChoice: Promise.resolve({ outcome: 'accepted' as const, platform: 'web' }),
    });

    render(
      <BrowserRouter>
        <ThemeProvider>
          <LLMProvider>
            <Header mobileMenuOpen={false} onToggleMobileMenu={vi.fn()} />
          </LLMProvider>
        </ThemeProvider>
      </BrowserRouter>,
    );

    // Initially install button is not present
    expect(screen.queryByRole('button', { name: /install app/i })).not.toBeInTheDocument();

    // Trigger beforeinstallprompt event
    act(() => {
      window.dispatchEvent(mockEvent);
    });

    // Install App button should now be visible in header
    const installBtn = screen.getByRole('button', { name: /install app/i });
    expect(installBtn).toBeInTheDocument();

    // Click install button
    await act(async () => {
      fireEvent.click(installBtn);
    });

    expect(mockEvent.prompt).toHaveBeenCalled();
  });

  it('MobileDrawer renders Install App action when PWA installable event is triggered', async () => {
    const mockEvent = Object.assign(new Event('beforeinstallprompt'), {
      preventDefault: vi.fn(),
      prompt: vi.fn().mockResolvedValue(undefined),
      platforms: ['web'],
      userChoice: Promise.resolve({ outcome: 'accepted' as const, platform: 'web' }),
    });

    render(
      <BrowserRouter>
        <ThemeProvider>
          <LLMProvider>
            <MobileDrawer isOpen={true} onClose={vi.fn()} />
          </LLMProvider>
        </ThemeProvider>
      </BrowserRouter>,
    );

    // Trigger beforeinstallprompt event
    act(() => {
      window.dispatchEvent(mockEvent);
    });

    const mobileInstallBtn = screen.getByRole('button', { name: /install app \(pwa\)/i });
    expect(mobileInstallBtn).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(mobileInstallBtn);
    });

    expect(mockEvent.prompt).toHaveBeenCalled();
  });
});
